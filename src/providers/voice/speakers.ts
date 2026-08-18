import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

/**
 * The speakers, borrowed from ffplay — the player that ships with the same
 * Homebrew `ffmpeg` the microphone already needs. It is handed raw PCM on a
 * pipe and plays it as it arrives, which is what makes a reply audible before
 * it has finished being synthesised.
 *
 * One player for the whole Session rather than one per phrase. Starting ffplay
 * costs a quarter of a second and opening the audio device makes a small click;
 * paying that between every sentence of one reply would be heard.
 *
 * A subprocess rather than a native audio binding, for the same reason
 * whisper.cpp is one: nothing here has to be rebuilt against Electron's ABI.
 */

/** Signed 16-bit samples, one channel: two bytes of file per sample of sound. */
const BYTES_PER_SAMPLE = 2

/**
 * How long ffplay takes between being handed its first bytes and making a
 * sound — process start plus opening the audio device. Measured at about 290ms
 * on an M1 Pro; the round number below is deliberately a little under, because
 * this is used to decide when speech has finished and finishing early merely
 * lets the Owner talk over the last syllable, while finishing late holds a turn
 * open on silence.
 */
const STARTUP_MS = 250

/** How long `bytes` of this audio takes to say. */
export function millisecondsOfAudio(bytes: number, sampleRate: number): number {
  return (bytes / (sampleRate * BYTES_PER_SAMPLE)) * 1000
}

export class Speakers {
  readonly #sampleRate: number
  #ffplay: ChildProcessWithoutNullStreams | undefined
  #gone: Promise<void> | undefined
  /** When what has been handed over will have finished being heard. */
  #quietAt = 0
  #failure: Error | undefined

  constructor(sampleRate: number) {
    this.#sampleRate = sampleRate
  }

  /**
   * Plays audio as soon as it exists. Deliberately not async: audio arrives
   * from a socket in whatever pieces the network gives it, and making each
   * piece something to await would put the network's rhythm into the sound.
   *
   * A player that failed to start says so from `untilQuiet`, which is where
   * something is waiting to hear about it.
   */
  play(audio: Buffer): void {
    if (audio.length === 0) return
    const started = this.#ffplay !== undefined
    const ffplay = this.#player()
    ffplay.stdin.write(audio)

    // Where the sound has got to. `max` rather than plain addition because a
    // reply can arrive slower than it is spoken — the player empties, waits,
    // and starts again from now rather than from where the last piece ended.
    const from = Math.max(performance.now() + (started ? 0 : STARTUP_MS), this.#quietAt)
    this.#quietAt = from + millisecondsOfAudio(audio.length, this.#sampleRate)
  }

  /** Resolves once everything handed over has been heard. */
  async untilQuiet(): Promise<void> {
    for (;;) {
      if (this.#failure !== undefined) throw this.#failure
      const left = this.#quietAt - performance.now()
      if (left <= 0) return
      await delay(left)
    }
  }

  /**
   * Stops playing, having first played what is left. Whoever is about to exit
   * must wait for this: killing the player instead cuts off mid-word, and the
   * last thing T.O.E.Z. said is the part the Owner is listening for.
   */
  async close(): Promise<void> {
    const ffplay = this.#ffplay
    const gone = this.#gone
    if (ffplay === undefined || gone === undefined) return
    this.#ffplay = undefined
    this.#gone = undefined
    this.#quietAt = 0
    ffplay.stdin.end()
    // `-autoexit`, in the arguments below: ffplay leaves once it reaches the
    // end of the input and has played all of it.
    await gone
  }

  #player(): ChildProcessWithoutNullStreams {
    if (this.#ffplay !== undefined) return this.#ffplay

    const ffplay = spawn('ffplay', [
      '-hide_banner',
      '-loglevel', 'error',
      // No window: this is a menu bar app, and ffplay opens one otherwise.
      '-nodisp',
      // Leave when the input ends, so closing the pipe is enough to stop it.
      '-autoexit',
      // Raw samples have no header to describe them, so the format is given
      // here instead. It has to match what the Voice provider asked for.
      '-f', 's16le',
      '-ar', String(this.#sampleRate),
      // ffplay has no `-ac`; channels are named this way or not at all.
      '-ch_layout', 'mono',
      '-i', 'pipe:0',
    ])
    this.#ffplay = ffplay

    // Deliberately never rejects, and settles on either ending: a process that
    // never started emits `error` and no `close`, and a promise nobody is
    // awaiting yet must not take the process down when it rejects.
    this.#gone = new Promise<void>((resolve) => {
      ffplay.once('error', (error: NodeJS.ErrnoException) => {
        this.#failure =
          error.code === 'ENOENT'
            ? new Error('ffplay is not installed — see docs/voice.md.')
            : error
        resolve()
      })
      ffplay.once('close', (code: number | null) => {
        // A player that stopped while still the one in use took the rest of
        // the reply down with it, silently: the pipe raises EPIPE, the clock
        // below keeps counting, and T.O.E.Z. appears to be talking to a room
        // that cannot hear it. `close` below ends the player on purpose, and
        // takes it out of use first, so this does not fire for that.
        if (this.#ffplay === ffplay) {
          this.#failure = new Error(
            `ffplay stopped with code ${String(code)}; nothing can be heard.`,
          )
        }
        resolve()
      })
    })
    // A player that has already died raises EPIPE on the pipe rather than at
    // the call, and an unhandled one of those ends the whole process.
    ffplay.stdin.on('error', () => undefined)

    return ffplay
  }
}
