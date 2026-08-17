import type { Transcriber } from '../ports/transcriber.ts'
import type { Utterance } from '../utterance.ts'
import { Script } from './script.ts'

/**
 * A fake Transcriber that hands back canned Utterances instead of listening to
 * a microphone — one per push-to-talk turn, in order.
 *
 * It refuses to capture out of pairs, so a Session that opens the microphone
 * without closing it fails here rather than quietly running the mic loose.
 */
export class CannedTranscriber implements Transcriber {
  readonly #canned: Script<string>
  #capturing = false

  constructor(canned: readonly string[]) {
    this.#canned = new Script('canned Utterances', canned)
  }

  async startCapture(): Promise<void> {
    if (this.#capturing) {
      throw new Error('CannedTranscriber was already capturing.')
    }
    // The real microphone takes about half a second to open and is not
    // recording until it has. Opening instantly here would hide every bug that
    // lives in that gap, so this one also becomes ready a turn late.
    await Promise.resolve()
    this.#capturing = true
  }

  stopCapture(): Promise<Utterance> {
    if (!this.#capturing) {
      throw new Error('CannedTranscriber was asked to stop without capturing.')
    }
    this.#capturing = false
    return Promise.resolve({ text: this.#canned.next() })
  }
}
