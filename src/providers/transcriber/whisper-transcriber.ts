import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Transcriber } from '../../core/ports/transcriber.ts'
import type { Utterance } from '../../core/utterance.ts'
import { Microphone } from './microphone.ts'
import { Whisper, type Heard, type WhisperOptions } from './whisper.ts'

/**
 * T.O.E.Z.'s real ears: the microphone recorded straight to disk while the
 * push-to-talk key is held, then read by whisper.cpp on this machine.
 *
 * The recording is deleted the moment it has been transcribed. Nothing the
 * Owner says is kept as audio — the Transcript (a later ticket) keeps words.
 */

export interface WhisperTranscriberOptions extends WhisperOptions {
  /**
   * Where to keep each recording instead of deleting it. Off by default: what
   * the Owner says is not kept as audio. Turned on when a transcript comes back
   * wrong and the only way to tell a misheard word from a bad microphone is to
   * listen to what was actually recorded.
   */
  readonly keepRecordingsIn?: string
  /**
   * Told the moment the microphone is genuinely recording — which is a good
   * half-second after the key went down. This is the Owner's cue to speak, so
   * whatever shows them they are being heard belongs here rather than on the
   * keypress.
   */
  readonly onListening?: () => void
  /**
   * Told what Whisper made of each utterance. Diagnostics for tuning the model
   * and the language setting; the Session neither sees this nor depends on it.
   */
  readonly onHeard?: (heard: Heard) => void
}

export class WhisperTranscriber implements Transcriber {
  readonly #microphone: Microphone
  readonly #whisper: Whisper
  readonly #keepRecordingsIn: string | undefined
  readonly #onListening: (() => void) | undefined
  readonly #onHeard: ((heard: Heard) => void) | undefined
  #turn: Turn | undefined

  constructor(options: WhisperTranscriberOptions) {
    this.#microphone = new Microphone()
    this.#whisper = new Whisper(options)
    this.#keepRecordingsIn = options.keepRecordingsIn
    this.#onListening = options.onListening
    this.#onHeard = options.onHeard
  }

  /**
   * Opens the microphone. Resolves once it is genuinely recording, roughly half
   * a second later — so whatever is showing the Owner they are being listened
   * to should wait for this rather than for the keypress.
   */
  async startCapture(): Promise<void> {
    if (this.#turn !== undefined) {
      throw new Error('The Transcriber is already listening.')
    }
    const directory = await mkdtemp(join(tmpdir(), 'toez-'))
    const turn: Turn = { directory, wavPath: join(directory, 'utterance.wav') }
    this.#turn = turn

    try {
      await this.#microphone.open(turn.wavPath)
    } catch (error) {
      this.#turn = undefined
      await rm(directory, { recursive: true, force: true })
      throw error
    }
    this.#onListening?.()
  }

  /** Closes the microphone and hands back what Whisper read in the recording. */
  async stopCapture(): Promise<Utterance> {
    const turn = this.#turn
    if (turn === undefined) {
      throw new Error('The Transcriber was asked what was said without listening.')
    }
    this.#turn = undefined

    try {
      await this.#microphone.close()
      const heard = await this.#whisper.transcribe(turn.wavPath)
      await this.#keep(turn)
      this.#onHeard?.(heard)
      return { text: heard.text }
    } finally {
      await rm(turn.directory, { recursive: true, force: true })
    }
  }

  /** Saves the recording under the moment it was made, if asked to. */
  async #keep(turn: Turn): Promise<void> {
    if (this.#keepRecordingsIn === undefined) return
    const stamp = new Date().toISOString().replaceAll(':', '-')
    await copyFile(turn.wavPath, join(this.#keepRecordingsIn, `${stamp}.wav`))
  }
}

/** Where one held-key turn is being recorded. */
interface Turn {
  readonly directory: string
  readonly wavPath: string
}
