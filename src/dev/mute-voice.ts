import type { VoiceProvider } from '../core/ports/voice.ts'

/**
 * A mouth that makes no sound and says nothing about it. `pnpm ask` uses
 * `PrintingVoice`, which announces that speech would happen here; on the ears'
 * surface there is no reply to speak, and a line reporting that every turn
 * would be noise between the Owner and the words they came to read.
 *
 * MiniMax and the Apple `say` command arrive in T4 (ADR-0003).
 */
export class MuteVoice implements VoiceProvider {
  speak(): Promise<void> {
    return Promise.resolve()
  }
}
