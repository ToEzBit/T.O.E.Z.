import { assertNever } from '../assert-never.ts'
import type { SessionEffect } from './effects.ts'
import type { SessionEvent } from './events.ts'

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
  /** The key is up; transcribing and generating a reply. */
  | 'thinking'
  /** Saying the reply aloud. */
  | 'speaking'

export interface SessionState {
  readonly phase: SessionPhase
  /** The reply accumulated so far, across the chunks streamed by the Engine. */
  readonly reply: string
}

/**
 * Where a Session rests between turns — and so also where it starts. A Session
 * spans the whole conversation; it passes back through here after every reply.
 */
export const idleSessionState: SessionState = { phase: 'idle', reply: '' }

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
        state: { phase: 'listening', reply: '' },
        effects: [{ type: 'start-capture' }],
      }

    case 'hotkey-released':
      if (state.phase !== 'listening') return unchanged(state)
      return {
        state: { ...state, phase: 'thinking' },
        effects: [{ type: 'stop-capture' }],
      }

    case 'utterance-transcribed':
      if (state.phase !== 'thinking') return unchanged(state)
      return {
        state,
        effects: [
          { type: 'send-to-engine', request: { utterance: event.utterance } },
        ],
      }

    case 'reply-chunk-received':
      if (state.phase !== 'thinking') return unchanged(state)
      return {
        state: { ...state, reply: state.reply + event.chunk.text },
        effects: [],
      }

    case 'reply-completed':
      if (state.phase !== 'thinking') return unchanged(state)
      return {
        state: { ...state, phase: 'speaking' },
        effects: [{ type: 'speak', request: { text: state.reply } }],
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
