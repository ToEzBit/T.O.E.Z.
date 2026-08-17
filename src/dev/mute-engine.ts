import type { Engine, ReplyChunk } from '../core/ports/engine.ts'

/**
 * A brain with nothing to say. `pnpm listen` is about the ears, and giving it a
 * real Engine would spend subscription tokens on a question it is not asking —
 * so the turn runs its full length and the reply is empty.
 *
 * The real Engine (T3) is what `pnpm ask` runs, and what the whole loop uses
 * from T5 on.
 */
export class MuteEngine implements Engine {
  async *reply(): AsyncIterable<ReplyChunk> {
    // Deliberately nothing. A Session with a mute Engine still runs its whole
    // turn: it just has no words to show and none to speak.
  }
}
