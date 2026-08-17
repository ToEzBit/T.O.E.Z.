import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { open, type FileHandle } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

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

/** How often ffmpeg reports progress, and so how soon it can be seen running. */
const PROGRESS_PERIOD_SECONDS = '0.1'

/**
 * The WAV header ffmpeg writes before the first sample, with `+bitexact` above
 * keeping it to the canonical size. `ears.integration.test.ts` checks that it
 * really is: reading audio from the wrong offset finds the header's own text
 * and mistakes it for sound.
 */
const WAV_HEADER_BYTES = 44

/** How often to look at the file for the first sample that is not silence. */
const LISTEN_POLL_MS = 40

/**
 * How long to keep waiting for that sample before giving up and saying the
 * microphone is open anyway.
 *
 * A Bluetooth headset takes two to three seconds to start sending audio; a
 * built-in microphone takes almost none. Past this, the likelier explanation is
 * a device that is muted or broken, and the Owner is better served by being let
 * on with it than by a cue that never comes.
 */
const LISTEN_TIMEOUT_MS = 6000

export class Microphone {
  #recording: Recording | undefined

  /**
   * Opens the microphone and records into `path`. Resolves only once the device
   * is genuinely sending audio, which is not the same as ffmpeg having started:
   * a Bluetooth headset spends two to three seconds negotiating before it sends
   * anything, and ffmpeg writes digital silence into the file the whole time.
   *
   * Whoever waits on this is holding the Owner's cue to speak, and words spoken
   * before it are not quietly recorded badly — they are not recorded at all.
   */
  async open(path: string): Promise<void> {
    if (this.#recording !== undefined) {
      throw new Error('The microphone is already open.')
    }
    const recording = new Recording(path)
    this.#recording = recording
    try {
      await recording.untilLive()
      await untilHearing(path)
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
      // Progress on stdout says ffmpeg is running; it says nothing about
      // whether the device has started sending. Its human-readable lines are
      // not a contract either.
      '-progress', 'pipe:1',
      '-nostats',
      '-stats_period', PROGRESS_PERIOD_SECONDS,
      // Without this the whole recording is buffered and the file stays zero
      // bytes until the microphone closes — which makes it impossible to look
      // at what has been captured so far, and that is exactly what has to be
      // looked at to know the device is really sending.
      '-flush_packets', '1',
      // No `LIST`/`ISFT` chunk naming the ffmpeg build. Two reasons: the header
      // is then exactly WAV_HEADER_BYTES long, so the first audio sample is
      // where it is expected rather than thirty-four bytes of text later — and
      // a recording of the Owner has no business carrying a version string.
      '-fflags', '+bitexact',
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

/**
 * Waits until the recording contains a sample that is not silence.
 *
 * A device that has not started sending writes exact zeroes, and a device that
 * has writes a noise floor — no room is silent to the last bit. So "not all
 * zeroes" is the honest test for whether anything is being heard, and it needs
 * no threshold to be tuned or guessed at.
 */
async function untilHearing(path: string): Promise<void> {
  const deadline = Date.now() + LISTEN_TIMEOUT_MS
  let handle: FileHandle | undefined
  // Where the last look got to, so each one reads only what is new.
  let position = WAV_HEADER_BYTES
  const buffer = Buffer.alloc(8192)

  try {
    for (;;) {
      handle ??= await open(path, 'r').catch(() => undefined)
      if (handle !== undefined) {
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, position)
        position += bytesRead
        if (buffer.subarray(0, bytesRead).some((byte) => byte !== 0)) return
      }
      if (Date.now() >= deadline) return
      await delay(LISTEN_POLL_MS)
    }
  } finally {
    await handle?.close()
  }
}
