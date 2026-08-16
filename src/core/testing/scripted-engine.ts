import type { Engine, EngineRequest, ReplyChunk } from '../ports/engine.ts'
import { Script } from './script.ts'

/**
 * A fake Engine that replays a script instead of calling the Agent SDK: no
 * subscription tokens spent, no flakiness, exact control over chunk boundaries.
 *
 * Each entry in `script` is one reply, split into the chunks it should stream.
 */
export class ScriptedEngine implements Engine {
  readonly requests: EngineRequest[] = []
  readonly #script: Script<readonly string[]>

  constructor(script: readonly (readonly string[])[]) {
    this.#script = new Script('scripted replies', script)
  }

  reply(request: EngineRequest): AsyncIterable<ReplyChunk> {
    this.requests.push(request)
    return toStream(this.#script.next())
  }
}

async function* toStream(chunks: readonly string[]): AsyncIterable<ReplyChunk> {
  for (const text of chunks) {
    await Promise.resolve()
    yield { text }
  }
}
