import type { SpeakRequest, VoiceProvider } from '../../core/ports/voice.ts'
import { MinimaxSocket, SAMPLE_RATE, type MinimaxOptions } from './minimax.ts'
import { millisecondsOfAudio, Speaker } from './speaker.ts'

/**
 * T.O.E.Z.'s real mouth: MiniMax synthesising, ffplay playing, one phrase at a
 * time as the reply is written (ADR-0003).
 *
 * The Session hands this whole sentences and phrases rather than the whole
 * reply — that decision is the orchestrator's, in `phrases.ts` — and this
 * speaks each one as it comes. `speak` resolves when the phrase has been
 * *heard*, not when it has been synthesised, because the Session goes back to
 * waiting for the Owner on the strength of it.
 *
 * The connection is kept between phrases and dropped when it stops working.
 * That is worth the bookkeeping: opening one costs a round trip to Singapore,
 * and paying it between the sentences of a single reply would be audible.
 */

/**
 * The Voice the Owner chose, of MiniMax's four Thai ones. It is a default and
 * not a decision: choosing a Voice properly, in Settings, is T11.
 */
export const defaultVoiceId = 'Thai_male_1_sample8'

/**
 * The turbo model rather than the HD one, because this is a conversation and
 * the Owner is waiting through every millisecond of it (ADR-0003).
 */
export const defaultVoiceModel = 'speech-2.6-turbo'

/** What one phrase cost, in the two numbers that decide how this feels. */
export interface Spoken {
  readonly text: string
  /** From asking MiniMax for this phrase to the first audio of it arriving. */
  readonly waitedMs: number
  /** How much speech it turned out to be. */
  readonly audioMs: number
}

export interface MinimaxVoiceOptions extends Partial<MinimaxOptions> {
  /** From the environment, and required. See docs/voice.md. */
  readonly apiKey: string
  /**
   * Told what each phrase cost. Diagnostics for judging whether this is fast
   * enough to talk to; the Session neither sees this nor depends on it.
   */
  readonly onSpoke?: (spoken: Spoken) => void
}

export class MinimaxVoice implements VoiceProvider {
  readonly #minimax: MinimaxOptions
  readonly #onSpoke: ((spoken: Spoken) => void) | undefined
  readonly #speaker = new Speaker(SAMPLE_RATE)
  #socket: MinimaxSocket | undefined

  constructor(options: MinimaxVoiceOptions) {
    this.#minimax = {
      apiKey: options.apiKey,
      voiceId: options.voiceId ?? defaultVoiceId,
      model: options.model ?? defaultVoiceModel,
    }
    this.#onSpoke = options.onSpoke
  }

  async speak(request: SpeakRequest): Promise<void> {
    const text = request.text.trim()
    if (text === '') return

    const asked = performance.now()
    let firstAudioAt: number | undefined
    let bytes = 0

    const socket = await this.#connection()
    try {
      await socket.say(text, (audio) => {
        firstAudioAt ??= performance.now()
        bytes += audio.length
        this.#speaker.play(audio)
      })
    } catch (error) {
      // Whatever went wrong, this connection is not to be spoken through
      // again. The next phrase opens a fresh one.
      this.#socket = undefined
      socket.close()
      throw error
    }

    await this.#speaker.untilQuiet()
    this.#onSpoke?.({
      text,
      waitedMs: (firstAudioAt ?? performance.now()) - asked,
      audioMs: millisecondsOfAudio(bytes, SAMPLE_RATE),
    })
  }

  /**
   * Stops, having said what was left to say. Anything about to exit must wait
   * for this, or the last thing T.O.E.Z. said is cut off mid-word.
   */
  async close(): Promise<void> {
    this.#socket?.close()
    this.#socket = undefined
    await this.#speaker.close()
  }

  async #connection(): Promise<MinimaxSocket> {
    const open = this.#socket
    if (open?.usable === true) return open
    // MiniMax hangs up on a connection left quiet for two minutes, which
    // between one turn and the next is entirely normal.
    this.#socket = await MinimaxSocket.open(this.#minimax)
    return this.#socket
  }
}
