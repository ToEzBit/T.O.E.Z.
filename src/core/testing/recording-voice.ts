import type { SpeakRequest, VoiceProvider } from '../ports/voice.ts'

/**
 * A fake Voice provider that records what it was asked to say instead of making
 * sound. What T.O.E.Z. spoke is observable behaviour, so this is what
 * orchestrator tests assert against.
 */
export class RecordingVoice implements VoiceProvider {
  readonly spoken: SpeakRequest[] = []

  speak(request: SpeakRequest): Promise<void> {
    this.spoken.push(request)
    return Promise.resolve()
  }
}
