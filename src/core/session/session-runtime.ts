import type { Engine } from '../ports/engine.ts'
import type { Transcriber } from '../ports/transcriber.ts'
import type { VoiceProvider } from '../ports/voice.ts'
import type { SessionEffect } from './effects.ts'
import type { SessionEvent } from './events.ts'
import { handle, initialSessionState, type SessionState } from './orchestrator.ts'

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
  #state: SessionState = initialSessionState

  constructor(ports: SessionPorts) {
    this.#ports = ports
  }

  get state(): SessionState {
    return this.#state
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
   */
  async dispatch(event: SessionEvent): Promise<void> {
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
        await this.dispatch({ type: 'utterance-transcribed', utterance })
        return
      }

      case 'send-to-engine': {
        for await (const chunk of this.#ports.engine.reply(effect.request)) {
          await this.dispatch({ type: 'reply-chunk-received', chunk })
        }
        await this.dispatch({ type: 'reply-completed' })
        return
      }

      case 'speak':
        await this.#ports.voice.speak(effect.request)
        await this.dispatch({ type: 'speech-finished' })
        return

      default:
        assertNever(effect)
    }
  }
}

function assertNever(effect: never): never {
  throw new Error(`Unhandled SessionEffect: ${JSON.stringify(effect)}`)
}
