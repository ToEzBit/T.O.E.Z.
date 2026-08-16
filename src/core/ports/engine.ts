import type { Utterance } from '../utterance.ts'

/**
 * The Engine is T.O.E.Z.'s brain: the Claude Agent SDK running on the Owner's
 * subscription (ADR-0002). It stays behind this interface so that swapping to
 * headless Claude Code stays cheap, and so orchestrator tests never spend
 * subscription tokens.
 */

/** One turn of the Session handed to the Engine. */
export interface EngineRequest {
  readonly utterance: Utterance
}

/** One incremental piece of a reply, as it streams back. */
export interface ReplyChunk {
  readonly text: string
}

export interface Engine {
  /**
   * Streams the reply to one Owner utterance. Chunks arrive as they are
   * generated so speech can start before the reply is finished.
   */
  reply(request: EngineRequest): AsyncIterable<ReplyChunk>
}
