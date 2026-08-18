import { assertNever } from '../assert-never.ts'
import type { Engine } from '../ports/engine.ts'
import type { Transcriber } from '../ports/transcriber.ts'
import type { VoiceProvider } from '../ports/voice.ts'
import type { SessionEffect } from './effects.ts'
import type { SessionEvent } from './events.ts'
import { handle, idleSessionState, type SessionState } from './orchestrator.ts'

/**
 * The runtime carries out what the orchestrator decides: it runs each effect
 * against the real (or fake) providers and feeds what comes back in as the next
 * event. All the awaiting lives here, so the orchestrator can stay pure.
 */

export interface SessionPorts {
  readonly engine: Engine
  readonly transcriber: Transcriber
  readonly voice: VoiceProvider
}

export type EffectListener = (effect: SessionEffect) => void

export class SessionRuntime {
  readonly #ports: SessionPorts
  readonly #listeners = new Set<EffectListener>()
  #state: SessionState = idleSessionState
  #queue: Promise<void> = Promise.resolve()

  constructor(ports: SessionPorts) {
    this.#ports = ports
  }

  /**
   * Watch what the Session does. This is how the Panel will follow along, and
   * how tests read the effect log.
   */
  onEffect(listener: EffectListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  /**
   * Feeds one event through the orchestrator and runs whatever it asks for.
   * Resolves once the work that event set off has settled.
   *
   * Events queue behind each other. They have to: a key release arrives when
   * the Owner lets go, not when the Session is ready for it, and the
   * microphone takes about half a second to open — so a quick tap would
   * otherwise have the release closing a microphone that is still opening.
   * Nothing changes for a caller that already awaits one event before sending
   * the next.
   */
  dispatch(event: SessionEvent): Promise<void> {
    const settled = this.#queue.then(() => this.#step(event))
    // The caller still sees the failure; the queue does not keep it, or one
    // bad turn would fail every event after it.
    this.#queue = settled.catch(() => undefined)
    return settled
  }

  /**
   * One event, straight through. Effects that raise further events call this
   * rather than `dispatch`, because an event raised from inside the queue
   * cannot wait for the queue to drain — it *is* what the queue is waiting on.
   */
  async #step(event: SessionEvent): Promise<void> {
    const step = handle(this.#state, event)
    this.#state = step.state

    for (const effect of step.effects) {
      for (const listener of this.#listeners) listener(effect)
      await this.#run(effect)
    }
  }

  async #run(effect: SessionEffect): Promise<void> {
    switch (effect.type) {
      case 'start-capture':
        await this.#ports.transcriber.startCapture()
        return

      case 'stop-capture': {
        const utterance = await this.#ports.transcriber.stopCapture()
        await this.#step({ type: 'utterance-transcribed', utterance })
        return
      }

      case 'show-utterance':
      case 'show-reply-chunk':
        // Nothing to run: the listeners above have already seen it, and that is
        // the whole of showing something until the Panel exists (T6).
        return

      case 'send-to-engine': {
        for await (const chunk of this.#ports.engine.reply(effect.request)) {
          await this.#step({ type: 'reply-chunk-received', chunk })
        }
        await this.#step({ type: 'reply-completed' })
        return
      }

      case 'speak':
        // Awaited, and that has a consequence worth knowing: a `speak` raised
        // while the Engine is still writing holds up the loop above, so the
        // next phrase is not found — and not sent to be synthesised — until
        // this one has finished being heard. Every phrase after the first
        // therefore begins with however long the Voice takes to answer.
        //
        // Left this way deliberately for now. The alternative is a Voice that
        // is queued rather than awaited, which is a change to the port and to
        // what `speech-finished` means; whether it is worth making is a
        // question for the Owner's ear on `pnpm say`, which prints exactly
        // that wait. It also throttles `show-reply-chunk` to speaking speed,
        // which the Panel will care about (T6) and nothing does yet.
        await this.#ports.voice.speak(effect.request)
        await this.#step({ type: 'speech-finished' })
        return

      default:
        assertNever(effect, 'SessionEffect')
    }
  }
}
