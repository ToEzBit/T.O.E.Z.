import type { ReplyChunk } from '../ports/engine.ts'
import type { Utterance } from '../utterance.ts'

/**
 * Everything that can happen *to* a Session. The orchestrator only ever learns
 * about the world through one of these.
 *
 * Later tickets widen this union — permission answers, YOLO Mode, Engine
 * failures, Subagent activity all arrive here.
 */
export type SessionEvent =
  /** The push-to-talk key went down. */
  | { readonly type: 'hotkey-pressed' }
  /** The push-to-talk key came back up: the Owner has finished speaking. */
  | { readonly type: 'hotkey-released' }
  /** The Transcriber turned the captured audio into words. */
  | { readonly type: 'utterance-transcribed'; readonly utterance: Utterance }
  /** One more piece of the Engine's reply arrived. */
  | { readonly type: 'reply-chunk-received'; readonly chunk: ReplyChunk }
  /** The Engine finished this reply. */
  | { readonly type: 'reply-completed' }
  /** T.O.E.Z. finished speaking, and the turn is over. */
  | { readonly type: 'speech-finished' }
