/**
 * The Voice provider is T.O.E.Z.'s mouth. ADR-0003 makes this interface
 * mandatory: MiniMax must be swappable without rework, and no provider-specific
 * types may leak past a provider module.
 */

export interface SpeakRequest {
  /** Text to speak, in whichever language T.O.E.Z. is replying in. */
  readonly text: string
}

export interface VoiceProvider {
  /** Speaks the text and resolves once it has finished being spoken. */
  speak(request: SpeakRequest): Promise<void>
}
