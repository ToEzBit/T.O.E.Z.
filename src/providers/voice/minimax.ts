/**
 * MiniMax's text-to-audio service, over the streaming WebSocket protocol
 * (ADR-0003). This module is the only place that knows MiniMax exists: the ADR
 * requires that no MiniMax type reach past the provider, so that swapping to
 * Azure — or to Apple's own voices in T11 — is a new file rather than a rework.
 *
 * The protocol is a conversation. Connect, wait to be greeted, open a task with
 * the settings that hold for all of it, then hand over text; audio comes back
 * in pieces as it is synthesised, and a piece marked final ends that text. More
 * text may follow on the same connection, which is the whole reason for using
 * the socket rather than the HTTP endpoint: a reply is spoken sentence by
 * sentence, and paying for a new connection per sentence would be heard as a
 * gap between them.
 *
 * No API key is in this file or anywhere else in this repository — it arrives
 * from the environment at the edge of the program, and nothing here prints it.
 */

const ENDPOINT = 'wss://api.minimax.io/ws/v1/t2a_v2'

/**
 * Raw signed 16-bit samples at 24 kHz, which the Speaker plays without
 * decoding anything. MP3 would be a third of the bytes and would have to be
 * decoded before it could be played — latency in the one place this ticket
 * exists to keep it out of, and a format whose length cannot be read off the
 * byte count.
 */
export const SAMPLE_RATE = 24_000

/**
 * How long to wait for MiniMax to say anything at all before giving up on it.
 * The first audio is promised in a quarter of a second, so silence this long
 * is a connection that has stopped rather than one that is thinking — and a
 * Session left waiting on it would have no way back to idle.
 */
const SILENCE_MS = 15_000

export interface MinimaxOptions {
  /** From the environment. Never from a file in this repository. */
  readonly apiKey: string
  /** Which of MiniMax's voices speaks. See docs/voice.md. */
  readonly voiceId: string
  /** Which speech model synthesises it. */
  readonly model: string
}

/** One open task: a connection that has been greeted and told how to speak. */
export class MinimaxSocket {
  readonly #ws: WebSocket
  /** Replies that arrived before anything asked for them. */
  readonly #arrived: Reply[] = []
  #waiting: Waiting | undefined
  #ended: Error | undefined

  private constructor(ws: WebSocket) {
    this.#ws = ws

    ws.addEventListener('message', (message: MessageEvent) => {
      const data: unknown = message.data
      if (typeof data !== 'string') return
      this.#take(JSON.parse(data) as Reply)
    })
    ws.addEventListener('error', () => {
      // The browser-shaped error event carries no detail at all — not even the
      // HTTP status that refused the key. The close event below usually
      // follows with a code worth reading.
      this.#end(new Error('The connection to MiniMax failed.'))
    })
    ws.addEventListener('close', (closed: CloseEvent) => {
      this.#end(new Error(`MiniMax closed the connection (${String(closed.code)}).`))
    })
  }

  /**
   * Opens a connection and starts a task on it. Rejects if MiniMax refuses —
   * most often a key it does not accept, which arrives as a connection that
   * closes rather than as anything more helpful.
   */
  static async open(options: MinimaxOptions): Promise<MinimaxSocket> {
    const socket = new MinimaxSocket(
      new WebSocket(ENDPOINT, {
        headers: { Authorization: `Bearer ${options.apiKey}` },
      }),
    )

    try {
      await socket.#expect('connected_success')
      socket.#send({
        event: 'task_start',
        model: options.model,
        voice_setting: { voice_id: options.voiceId },
        audio_setting: {
          sample_rate: SAMPLE_RATE,
          format: 'pcm',
          channel: 1,
        },
        // Not a language, on purpose. One Voice speaks Thai and English in the
        // same sentence — "ไปแก้ bug ในโปรเจค X" is how the Owner talks and so
        // how T.O.E.Z. answers — and naming one of them here is choosing
        // against the other.
        language_boost: 'auto',
      })
      await socket.#expect('task_started')
      return socket
    } catch (error) {
      socket.close()
      // Wrapped, because what is underneath says nothing useful: a WebSocket
      // refused during its handshake reports a closed connection and no reason
      // at all, and the reason is almost always the key.
      throw new Error(
        `MiniMax would not start speaking. The likeliest cause is a key it ` +
          `does not accept — see docs/voice.md.\n${String(error)}`,
        { cause: error },
      )
    }
  }

  /** Whether this connection can still be spoken through. */
  get usable(): boolean {
    return this.#ended === undefined && this.#ws.readyState === WebSocket.OPEN
  }

  /**
   * Synthesises `text`, handing each piece of audio over the moment it arrives
   * rather than collecting them. Resolves when the last of that text has been
   * synthesised — not when it has been heard, which is the Speaker's business.
   */
  async say(text: string, onAudio: (audio: Buffer) => void): Promise<void> {
    this.#send({ event: 'task_continue', text })

    for (;;) {
      const reply = await this.#next()
      const audio = reply.data?.audio
      if (audio !== undefined && audio !== '') onAudio(Buffer.from(audio, 'hex'))
      // `task_finished` is MiniMax ending the whole task rather than this text;
      // either way there is no more audio for what was asked.
      if (reply.is_final === true || reply.event === 'task_finished') return
    }
  }

  /** Ends the task and the connection. Safe to call on a dead one. */
  close(): void {
    if (this.#ws.readyState === WebSocket.OPEN) {
      this.#send({ event: 'task_finish' })
    }
    this.#ws.close()
  }

  #send(message: Request): void {
    this.#ws.send(JSON.stringify(message))
  }

  /** Reads the next reply and insists it is the one the protocol promises. */
  async #expect(event: string): Promise<void> {
    const reply = await this.#next()
    if (reply.event !== event) {
      throw new Error(
        `MiniMax answered "${reply.event ?? 'nothing'}" where the protocol ` +
          `has "${event}".`,
      )
    }
  }

  /** The next reply from MiniMax, or the reason there will not be one. */
  #next(): Promise<Reply> {
    const arrived = this.#arrived.shift()
    if (arrived !== undefined) return Promise.resolve(arrived)
    if (this.#ended !== undefined) return Promise.reject(this.#ended)

    return new Promise<Reply>((resolve, reject) => {
      this.#waiting = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.#end(new Error(`MiniMax went quiet for ${String(SILENCE_MS)}ms.`))
        }, SILENCE_MS),
      }
    })
  }

  #take(reply: Reply): void {
    // A task that failed says so in its own reply rather than by disconnecting,
    // and the message is the only explanation there will be.
    const status = reply.base_resp
    if (reply.event === 'task_failed' || (status !== undefined && status.status_code !== 0)) {
      this.#end(
        new Error(
          `MiniMax refused: ${status?.status_msg ?? 'no reason given'} ` +
            `(${String(status?.status_code ?? 'no code')}).`,
        ),
      )
      return
    }

    const waiting = this.#waiting
    if (waiting === undefined) {
      this.#arrived.push(reply)
      return
    }
    this.#waiting = undefined
    clearTimeout(waiting.timer)
    waiting.resolve(reply)
  }

  /** The connection is over, for whatever reason came first. */
  #end(error: Error): void {
    if (this.#ended !== undefined) return
    this.#ended = error

    const waiting = this.#waiting
    if (waiting === undefined) return
    this.#waiting = undefined
    clearTimeout(waiting.timer)
    waiting.reject(error)
  }
}

interface Waiting {
  readonly resolve: (reply: Reply) => void
  readonly reject: (error: Error) => void
  readonly timer: NodeJS.Timeout
}

/** The part of MiniMax's replies T.O.E.Z. reads. */
interface Reply {
  readonly event?: string
  readonly data?: { readonly audio?: string }
  readonly is_final?: boolean
  readonly base_resp?: { readonly status_code: number; readonly status_msg: string }
}

/** The part of MiniMax's protocol T.O.E.Z. writes. */
type Request =
  | {
      readonly event: 'task_start'
      readonly model: string
      readonly voice_setting: { readonly voice_id: string }
      readonly audio_setting: {
        readonly sample_rate: number
        readonly format: string
        readonly channel: number
      }
      readonly language_boost: string
    }
  | { readonly event: 'task_continue'; readonly text: string }
  | { readonly event: 'task_finish' }
