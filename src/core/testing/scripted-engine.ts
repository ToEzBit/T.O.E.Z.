import type { Engine, EngineRequest, ReplyChunk } from '../ports/engine.ts'

/**
 * A fake Engine that replays a script instead of calling the Agent SDK: no
 * subscription tokens spent, no flakiness, exact control over chunk boundaries.
 *
 * Each entry in `script` is one reply, split into the chunks it should stream.
 */
export class ScriptedEngine implements Engine {
  readonly requests: EngineRequest[] = []
  readonly #script: readonly (readonly string[])[]
  #turn = 0

  constructor(script: readonly (readonly string[])[]) {
    this.#script = script
  }

  reply(request: EngineRequest): AsyncIterable<ReplyChunk> {
    this.requests.push(request)
    const chunks = this.#script[this.#turn]
    if (chunks === undefined) {
      throw new Error(
        `ScriptedEngine ran out of script: asked for turn ${String(this.#turn + 1)}, ` +
          `only ${String(this.#script.length)} scripted.`,
      )
    }
    this.#turn += 1
    return toStream(chunks)
  }
}

async function* toStream(chunks: readonly string[]): AsyncIterable<ReplyChunk> {
  for (const text of chunks) {
    await Promise.resolve()
    yield { text }
  }
}
