/**
 * The Transcriber is T.O.E.Z.'s ears: whisper.cpp running Thonburian Whisper,
 * on-device (ADR-0003). Capture is gated strictly by the held push-to-talk key,
 * so the orchestrator drives it in explicit start/stop pairs.
 */

/**
 * What the Owner said in one push-to-talk turn, as text.
 *
 * Not to be confused with a Transcript, which is the permanent record of a
 * whole Session (see CONTEXT.md).
 */
export interface Utterance {
  readonly text: string
}

export interface Transcriber {
  /** Begins capturing audio. Called when the push-to-talk key goes down. */
  startCapture(): Promise<void>

  /** Ends capture and resolves the Utterance that was heard. */
  stopCapture(): Promise<Utterance>
}
