import type { Transcriber, Utterance } from '../ports/transcriber.ts'

/**
 * A fake Transcriber that hands back canned Utterances instead of listening to
 * a microphone — one per push-to-talk turn, in order.
 *
 * `capturing` is exposed so tests can prove capture is gated by the key rather
 * than running loose.
 */
export class CannedTranscriber implements Transcriber {
  #capturing = false
  readonly #canned: readonly string[]
  #turn = 0

  constructor(canned: readonly string[]) {
    this.#canned = canned
  }

  get capturing(): boolean {
    return this.#capturing
  }

  startCapture(): Promise<void> {
    if (this.#capturing) {
      throw new Error('CannedTranscriber was already capturing.')
    }
    this.#capturing = true
    return Promise.resolve()
  }

  stopCapture(): Promise<Utterance> {
    if (!this.#capturing) {
      throw new Error('CannedTranscriber was asked to stop without capturing.')
    }
    this.#capturing = false
    const text = this.#canned[this.#turn]
    if (text === undefined) {
      throw new Error(
        `CannedTranscriber ran out of Utterances: asked for turn ${String(this.#turn + 1)}, ` +
          `only ${String(this.#canned.length)} canned.`,
      )
    }
    this.#turn += 1
    return Promise.resolve({ text })
  }
}
