import type { Transcriber } from '../core/ports/transcriber.ts'
import type { Utterance } from '../core/utterance.ts'

/**
 * Ears made of a keyboard. The real Transcriber (whisper.cpp, T2) turns held-key
 * audio into an Utterance; this one turns a typed line into the same thing, so
 * the Engine and the Session can be exercised before there is a microphone.
 *
 * Typing the line *is* holding the key: capture starts when the prompt appears
 * and ends when Enter is pressed, which is the same shape the real one has.
 */
export class TypedTranscriber implements Transcriber {
  readonly #readLine: () => Promise<string>
  #typing: Promise<string> | undefined

  constructor(readLine: () => Promise<string>) {
    this.#readLine = readLine
  }

  startCapture(): Promise<void> {
    this.#typing = this.#readLine()
    return Promise.resolve()
  }

  async stopCapture(): Promise<Utterance> {
    if (this.#typing === undefined) {
      throw new Error('Asked what was said before anything started listening.')
    }
    const text = await this.#typing
    this.#typing = undefined
    return { text }
  }
}
