import type { EngineRequest } from '../ports/engine.ts'
import type { SpeakRequest } from '../ports/voice.ts'

/**
 * Everything a Session can ask the outside world to do. These are plain data —
 * the orchestrator decides them, something else carries them out.
 *
 * Tests assert on exactly this list, because it is the whole of what the Owner
 * could observe.
 *
 * Later tickets widen this union — permission prompts, Memory writes,
 * Transcript appends, Panel updates, Subagent announcements all arrive here.
 */
export type SessionEffect =
  /** Open the microphone; the Owner is holding the key. */
  | { readonly type: 'start-capture' }
  /** Close the microphone and find out what was said. */
  | { readonly type: 'stop-capture' }
  /** Hand the Owner's utterance to the Engine. */
  | { readonly type: 'send-to-engine'; readonly request: EngineRequest }
  /** Say this aloud. */
  | { readonly type: 'speak'; readonly request: SpeakRequest }
