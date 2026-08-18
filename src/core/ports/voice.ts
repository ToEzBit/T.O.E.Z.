/**
 * The Voice provider is T.O.E.Z.'s mouth. ADR-0003 makes this interface
 * mandatory: MiniMax must be swappable without rework, and no provider-specific
 * types may leak past a provider module.
 */

export interface SpeakRequest {
  /**
   * Text to speak, in whichever language T.O.E.Z. is replying in — one phrase
   * of a reply rather than the whole of it, so that speech can begin while the
   * rest is still being written. Which words make a phrase is the Session's
   * decision, in `session/phrases.ts`.
   */
  readonly text: string
}

export interface VoiceProvider {
  /**
   * Speaks the text and resolves once it has finished being spoken — heard,
   * not merely synthesised. The Session goes back to waiting for the Owner on
   * the strength of it.
   */
  speak(request: SpeakRequest): Promise<void>
}
