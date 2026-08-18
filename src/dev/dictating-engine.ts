import { setTimeout as delay } from 'node:timers/promises'

import type { Engine, ReplyChunk } from '../core/ports/engine.ts'

/**
 * A stand-in Engine that writes one fixed reply at about the speed the real one
 * writes, a few characters at a time.
 *
 * `ScriptedEngine` in `core/testing` hands its chunks over as fast as they can
 * be taken, which is what a test wants and the opposite of what an audition
 * wants: the question `pnpm say` exists to answer is whether T.O.E.Z. starts
 * speaking before it has finished thinking, and a reply that arrives instantly
 * has no before.
 */

/** Roughly what a streamed reply reads out at: a couple of hundred characters
 * a second, arriving in small pieces rather than words. */
const CHARACTERS_PER_CHUNK = 12
const CHUNK_MS = 60

export class DictatingEngine implements Engine {
  readonly #reply: string

  constructor(reply: string) {
    this.#reply = reply
  }

  async *reply(): AsyncIterable<ReplyChunk> {
    for (let at = 0; at < this.#reply.length; at += CHARACTERS_PER_CHUNK) {
      await delay(CHUNK_MS)
      yield { text: this.#reply.slice(at, at + CHARACTERS_PER_CHUNK) }
    }
  }
}
