import type { EngineRequest, ReplyChunk } from '../ports/engine.ts'
import type { SpeakRequest } from '../ports/voice.ts'
import type { Utterance } from '../utterance.ts'

/**
 * Everything a Session can ask the outside world to do. These are plain data —
 * the orchestrator decides them, something else carries them out.
 *
 * Tests assert on exactly this list, because it is the whole of what the Owner
 * could observe.
 *
 * Later tickets widen this union — permission prompts, Memory writes,
 * Transcript appends, Panel updates, Subagent announcements all arrive here.
 *
 * Two widenings are already known to be coming, and are deliberately absent
 * until a ticket asks for them: T4 speaks sentence by sentence as the reply
 * streams, rather than once at the end as `speak` does here; and T5 needs a
 * way to cut speech off mid-sentence when the Owner keys in over it.
 */
export type SessionEffect =
  /** Open the microphone; the Owner is holding the key. */
  | { readonly type: 'start-capture' }
  /** Close the microphone and find out what was said. */
  | { readonly type: 'stop-capture' }
  /**
   * Put on screen what the Owner was heard to say. Separate from the Engine
   * call so the Owner can see they were heard correctly while the reply is
   * still being generated — and can tell a misheard word from a wrong answer.
   */
  | { readonly type: 'show-utterance'; readonly utterance: Utterance }
  /** Hand the Owner's utterance to the Engine. */
  | { readonly type: 'send-to-engine'; readonly request: EngineRequest }
  /**
   * Put one more piece of the reply on screen. Carries only the new text: the
   * Session already keeps the reply so far, so repeating it here would be two
   * copies of one fact. Nothing runs this yet — the Panel arrives in T6, and
   * until then the effect log is the only place a reply is watched.
   */
  | { readonly type: 'show-reply-chunk'; readonly chunk: ReplyChunk }
  /** Say this aloud. */
  | { readonly type: 'speak'; readonly request: SpeakRequest }
