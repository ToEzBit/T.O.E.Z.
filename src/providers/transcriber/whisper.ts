import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

/**
 * whisper.cpp, run as the `whisper-cli` command. On-device, Metal-accelerated,
 * and no network at any point (ADR-0003).
 *
 * A subprocess rather than a native binding on purpose: the alternative binds
 * whisper.cpp into Node, and that build then has to be redone against
 * Electron's ABI for the same result. `whisper-cli` is one binary that works
 * the same under `pnpm listen`, under the integration tests, and under Electron.
 *
 * Not bundled. `brew install whisper-cpp` — see docs/ears.md.
 */

const run = promisify(execFile)

/** What Whisper made of one recording. */
export interface Heard {
  /** The words. Empty when the recording held no speech. */
  readonly text: string
  /** The language Whisper decided it was in, as an ISO 639-1 code. */
  readonly language: string
}

export interface WhisperOptions {
  /** The ggml model file. See models.ts for where these live. */
  readonly modelPath: string
  /**
   * The Silero VAD model. Not optional: Whisper asked to transcribe silence
   * makes words up, and voice activity detection is what stops a mis-tap of
   * Right ⌘ from becoming an utterance.
   */
  readonly vadModelPath: string
  /**
   * The language to decode as, or `auto` to let Whisper decide per recording.
   * `auto` is the default because the Owner mixes Thai and English freely.
   */
  readonly language?: string
}

export class Whisper {
  readonly #modelPath: string
  readonly #vadModelPath: string
  readonly #language: string

  constructor(options: WhisperOptions) {
    this.#modelPath = options.modelPath
    this.#vadModelPath = options.vadModelPath
    this.#language = options.language ?? 'auto'
  }

  /**
   * Transcribes a 16 kHz mono WAV. Writes a JSON sidecar next to it, because
   * whisper-cli's console output mixes the transcript in with backend chatter,
   * while the JSON says separately what the words were and what language they
   * were taken to be.
   */
  async transcribe(wavPath: string): Promise<Heard> {
    await run('whisper-cli', [
      '-m', this.#modelPath,
      '-f', wavPath,
      '-l', this.#language,
      '--vad',
      '-vm', this.#vadModelPath,
      '-nt',
      '-np',
      '-oj',
      '-of', wavPath,
    ]).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        throw new Error('whisper-cli is not installed — see docs/ears.md.')
      }
      throw error
    })

    const report = JSON.parse(
      await readFile(`${wavPath}.json`, 'utf8'),
    ) as WhisperReport

    return {
      // Whisper hands every segment back with a leading space; a Session is
      // easier to reason about when an Utterance is either words or nothing.
      text: report.transcription
        .map((segment) => segment.text.trim())
        .filter((text) => text !== '')
        .join(' '),
      language: report.result.language,
    }
  }
}

/** The part of whisper-cli's `-oj` output T.O.E.Z. reads. */
interface WhisperReport {
  readonly result: { readonly language: string }
  readonly transcription: readonly { readonly text: string }[]
}
