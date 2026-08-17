import { assertNever } from '../assert-never.ts'
import type { SessionEffect } from './effects.ts'
import type { SessionEvent } from './events.ts'
import { takePhrases } from './phrases.ts'

/**
 * The Session orchestrator: the single place that decides what T.O.E.Z. does
 * next. It is a pure function — no awaiting, no I/O, no clocks. Everything it
 * needs arrives as a SessionEvent, and everything it wants done leaves as a
 * SessionEffect.
 *
 * Keeping it pure is what makes turn-taking testable as a list comparison, and
 * what will make interruption (T5) expressible as data rather than as
 * cancellation plumbing.
 */

/** What T.O.E.Z. is busy doing right now. */
export type SessionPhase =
  /** Waiting for the Owner. */
  | 'idle'
  /** The key is held; the Owner is speaking. */
  | 'listening'
  /**
   * The key is up; transcribing and generating a reply. Sentences of that
   * reply are spoken as they come, so this is not a silent phase.
   */
  | 'thinking'
  /** The reply is complete; saying the last of it aloud. */
  | 'speaking'

export interface SessionState {
  /**
   * The reply accumulated so far, across the chunks streamed by the Engine.
   * The whole of it, for the Panel and the Transcript to come.
   */
  readonly reply: string
  /**
   * The tail of that reply which has not been handed to the Voice yet, because
   * it is not yet a thing that can be spoken on its own. Kept apart from
   * `reply` so that what is on screen and what has been said aloud can differ,
   * which — mid-reply — they always do.
   */
  readonly unspoken: string
  readonly phase: SessionPhase
}

/**
 * Where a Session rests between turns — and so also where it starts. A Session
 * spans the whole conversation; it passes back through here after every reply.
 */
export const idleSessionState: SessionState = {
  phase: 'idle',
  reply: '',
  unspoken: '',
}

export interface SessionStep {
  readonly state: SessionState
  readonly effects: readonly SessionEffect[]
}

/**
 * Decides the next state and the effects to run. Events that make no sense for
 * the current phase are ignored — a Session that has not started listening has
 * nothing to say about a key release.
 */
export function handle(state: SessionState, event: SessionEvent): SessionStep {
  switch (event.type) {
    case 'hotkey-pressed':
      if (state.phase !== 'idle') return unchanged(state)
      return {
        state: { ...idleSessionState, phase: 'listening' },
        effects: [{ type: 'start-capture' }],
      }

    case 'hotkey-released':
      if (state.phase !== 'listening') return unchanged(state)
      return {
        state: { ...state, phase: 'thinking' },
        effects: [{ type: 'stop-capture' }],
      }

    case 'utterance-transcribed': {
      if (state.phase !== 'thinking') return unchanged(state)
      // Right ⌘ is a key the Owner presses for other reasons too, and silence
      // transcribes to nothing. A turn with no words in it ends here rather
      // than spending subscription tokens asking the Engine about silence.
      if (event.utterance.text.trim() === '') {
        return { state: idleSessionState, effects: [] }
      }
      return {
        state,
        effects: [
          { type: 'show-utterance', utterance: event.utterance },
          { type: 'send-to-engine', request: { utterance: event.utterance } },
        ],
      }
    }

    case 'reply-chunk-received': {
      if (state.phase !== 'thinking') return unchanged(state)
      // Everything that has become speakable goes to the Voice now, and the
      // rest waits for the chunk after this one. The Session stays in
      // `thinking` while it happens: it is still generating a reply, and
      // saying part of one aloud does not change that.
      const { phrases, rest } = takePhrases(state.unspoken + event.chunk.text)
      return {
        state: {
          ...state,
          reply: state.reply + event.chunk.text,
          unspoken: rest,
        },
        effects: [
          { type: 'show-reply-chunk', chunk: event.chunk },
          ...phrases.map((text) => speak(text)),
        ],
      }
    }

    case 'reply-completed': {
      if (state.phase !== 'thinking') return unchanged(state)
      // Whatever is left never became a whole sentence, and now never will:
      // nothing more is coming. It is spoken as it stands — and only it, since
      // everything before it has already been said.
      const last = state.unspoken.trim()
      if (last === '') return { state: idleSessionState, effects: [] }
      return {
        state: { ...state, unspoken: '', phase: 'speaking' },
        effects: [speak(last)],
      }
    }

    case 'speech-finished':
      if (state.phase !== 'speaking') return unchanged(state)
      return { state: idleSessionState, effects: [] }

    default:
      return assertNever(event, 'SessionEvent')
  }
}

function unchanged(state: SessionState): SessionStep {
  return { state, effects: [] }
}

function speak(text: string): SessionEffect {
  return { type: 'speak', request: { text } }
}
