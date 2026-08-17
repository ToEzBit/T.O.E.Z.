import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

/**
 * The microphone, borrowed from ffmpeg's avfoundation input. It writes exactly
 * what whisper.cpp wants — 16 kHz mono signed 16-bit PCM in a WAV file — so
 * nothing has to be resampled between the Owner speaking and Whisper reading.
 *
 * A file rather than a pipe on purpose: a WAV streamed to a pipe carries a
 * length field ffmpeg cannot know in advance, and whisper.cpp reads that field.
 *
 * ffmpeg is not bundled. `brew install ffmpeg` — see docs/ears.md.
 */

/**
 * Whatever macOS calls the default input, always — the Owner picks their
 * microphone where they already pick it, in Sound settings, and T.O.E.Z.
 * follows.
 *
 * That is usually AirPods, which as a microphone drop to call quality: 24 kHz
 * over Bluetooth against 48 from the built-in one. Whisper on that audio can
 * hear the sounds and still not place the language — which is why the language
 * is chosen rather than detected (ADR-0005), instead of the Owner being asked
 * to change headphones.
 */
const INPUT_DEVICE = ':default'

/**
 * How often ffmpeg reports progress. The first report is what tells us the
 * microphone is genuinely live, so this doubles as how quickly the Owner is
 * told they may speak.
 */
const PROGRESS_PERIOD_SECONDS = '0.1'

export class Microphone {
  #recording: Recording | undefined

  /**
   * Opens the microphone and records into `path`. Resolves only once audio is
   * actually being captured — the device takes around half a second to open,
   * and words spoken before that are simply not there. Whoever is waiting on
   * this promise is holding the Owner's cue to start talking.
   */
  async open(path: string): Promise<void> {
    if (this.#recording !== undefined) {
      throw new Error('The microphone is already open.')
    }
    const recording = new Recording(path)
    this.#recording = recording
    try {
      await recording.untilLive()
    } catch (error) {
      this.#recording = undefined
      throw error
    }
  }

  /** Closes the microphone and finishes the file, which is then readable. */
  async close(): Promise<void> {
    const recording = this.#recording
    if (recording === undefined) {
      throw new Error('The microphone was asked to close without being open.')
    }
    this.#recording = undefined
    await recording.finish()
  }
}

/** One ffmpeg process, from spawn to a finished WAV file. */
class Recording {
  readonly #ffmpeg: ChildProcessWithoutNullStreams
  readonly #live: Promise<void>
  readonly #exited: Promise<number | null>
  #complaints = ''

  constructor(path: string) {
    this.#ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'avfoundation',
      '-i', INPUT_DEVICE,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      // Progress on stdout is the only trustworthy "audio is flowing" signal;
      // ffmpeg's human-readable lines are not a contract.
      '-progress', 'pipe:1',
      '-nostats',
      '-stats_period', PROGRESS_PERIOD_SECONDS,
      '-y', path,
    ])

    this.#ffmpeg.stderr.on('data', (chunk: Buffer) => {
      // Bounded: a wedged ffmpeg must not grow this without limit.
      this.#complaints = (this.#complaints + chunk.toString()).slice(-2000)
    })

    // Writing `q` to a process that has already died raises EPIPE on the pipe
    // rather than at the call, and an unhandled one of those ends the process.
    this.#ffmpeg.stdin.on('error', () => undefined)

    // Deliberately never rejects. Nothing awaits it until `finish`, and a
    // promise that rejects with nobody listening takes the whole process down —
    // which is how a missing ffmpeg used to end in a stack trace rather than in
    // the sentence below. A process that never started emits `error` and no
    // `close`; one that started always emits `close`.
    this.#exited = new Promise((resolve) => {
      this.#ffmpeg.once('error', () => {
        resolve(null)
      })
      this.#ffmpeg.once('close', resolve)
    })

    this.#live = new Promise<void>((resolve, reject) => {
      this.#ffmpeg.stdout.once('data', () => {
        resolve()
      })
      this.#ffmpeg.once('error', (error: NodeJS.ErrnoException) => {
        reject(
          error.code === 'ENOENT'
            ? new Error('ffmpeg is not installed — see docs/ears.md.')
            : error,
        )
      })
      // Exiting before a single progress report means no audio was ever
      // captured. The usual cause is macOS refusing microphone access.
      this.#ffmpeg.once('close', () => {
        reject(new Error(`The microphone never opened.${this.#tail()}`))
      })
    })
  }

  untilLive(): Promise<void> {
    return this.#live
  }

  async finish(): Promise<void> {
    // `q` is ffmpeg's own graceful stop: it flushes and writes the WAV header
    // with the real length. Killing the process instead leaves a header that
    // claims a length the file does not have.
    this.#ffmpeg.stdin.write('q')
    this.#ffmpeg.stdin.end()

    const code = await this.#exited
    if (code !== 0) {
      throw new Error(`ffmpeg stopped with code ${String(code)}.${this.#tail()}`)
    }
  }

  #tail(): string {
    const complaints = this.#complaints.trim()
    return complaints === '' ? '' : `\n${complaints}`
  }
}
