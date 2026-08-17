import type { SpeakRequest, VoiceProvider } from '../core/ports/voice.ts'

/**
 * A mouth that stays shut. The reply has already appeared on screen chunk by
 * chunk by the time this runs, so it says only that speech would happen here —
 * repeating the words would just be the same text twice. One mark per phrase,
 * which is where the Owner would have started hearing that part of the reply.
 *
 * The real mouth is `MinimaxVoice`, auditioned with `pnpm say`; putting it on
 * this surface, with the ears at the other end, is T5. Apple's own voices are
 * T11 (ADR-0003).
 */
export class PrintingVoice implements VoiceProvider {
  speak(request: SpeakRequest): Promise<void> {
    const words = request.text.trim().split(/\s+/).length
    process.stdout.write(`\n   🔇 spoken aloud here (${String(words)} words)\n`)
    return Promise.resolve()
  }
}
