import type { SpeakRequest, VoiceProvider } from '../core/ports/voice.ts'

/**
 * A mouth that stays shut. The reply has already appeared on screen chunk by
 * chunk by the time this runs, so it says only that speech would happen here —
 * repeating the whole reply would just be the same text twice.
 *
 * MiniMax and the Apple `say` command arrive in T4 (ADR-0003).
 */
export class PrintingVoice implements VoiceProvider {
  speak(request: SpeakRequest): Promise<void> {
    const words = request.text.trim().split(/\s+/).length
    process.stdout.write(`\n   🔇 spoken aloud from T4 (${String(words)} words)\n`)
    return Promise.resolve()
  }
}
