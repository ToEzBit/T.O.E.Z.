import type { VoiceProvider } from '../core/ports/voice.ts'

/**
 * A mouth that makes no sound and says nothing about it. `pnpm ask` uses
 * `PrintingVoice`, which announces that speech would happen here; on the ears'
 * surface there is no reply to speak, and a line reporting that every turn
 * would be noise between the Owner and the words they came to read.
 *
 * The real mouth is `MinimaxVoice`, auditioned with `pnpm say`; putting it on
 * this surface is T5. Apple's own voices are T11 (ADR-0003).
 */
export class MuteVoice implements VoiceProvider {
  speak(): Promise<void> {
    return Promise.resolve()
  }
}
