import type { Utterance } from '../utterance.ts'

/**
 * The Transcriber is T.O.E.Z.'s ears: whisper.cpp running Thonburian Whisper,
 * on-device (ADR-0003). Capture is gated strictly by the held push-to-talk key,
 * so the orchestrator drives it in explicit start/stop pairs.
 */
export interface Transcriber {
  /** Begins capturing audio. Called when the push-to-talk key goes down. */
  startCapture(): Promise<void>

  /** Ends capture and resolves the Utterance that was heard. */
  stopCapture(): Promise<Utterance>
}
