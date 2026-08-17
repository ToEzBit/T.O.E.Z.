import { describe, expect, it } from 'vitest'

import {
  defaultVoiceId,
  defaultVoiceModel,
} from '../src/providers/voice/minimax-voice.ts'
import { MinimaxSocket, SAMPLE_RATE } from '../src/providers/voice/minimax.ts'
import { millisecondsOfAudio, Speakers } from '../src/providers/voice/speakers.ts'

/**
 * The mouth's contract, against the real MiniMax and the real ffplay. The
 * orchestrator's behaviour — which words are handed over, and when — is proved
 * with the recording fake in the fast suite; what can only be proved here is
 * that the thing behind the interface turns Thai into sound, keeps one voice
 * across a change of language, and will take a second phrase down a connection
 * it has already used.
 *
 * Nothing here is played aloud except silence, and none of it says whether the
 * Voice is pleasant to be spoken to by. That is `pnpm say`, and it is the
 * Owner's ear that answers it — exactly as the Owner's voice, not this suite,
 * settled every question about the ears.
 *
 * Needs the setup in docs/voice.md: a MiniMax API key, and the ffmpeg that
 * docs/ears.md already installs. It spends MiniMax characters when it runs.
 */

// `pnpm say` is given the .env file by Node itself; vitest takes no such flag,
// so it is read here.
try {
  process.loadEnvFile()
} catch {
  // No .env, which is fine — the key may be exported in the shell instead.
}

const apiKey = process.env.MINIMAX_API_KEY ?? ''

/** How MiniMax is asked to speak, everywhere below. */
const settings = {
  apiKey,
  voiceId: process.env.TOEZ_VOICE ?? defaultVoiceId,
  model: process.env.TOEZ_VOICE_MODEL ?? defaultVoiceModel,
}

describe('MiniMax', () => {
  it('has an API key to be tested with', () => {
    // Said plainly rather than skipped: a suite that quietly passes with
    // nothing run is worse than one that says what it is missing.
    expect(apiKey, 'No MINIMAX_API_KEY — see docs/voice.md.').not.toBe('')
  })

  it('turns Thai into speech', { timeout: 60_000 }, async () => {
    const heard = await synthesise('สวัสดีครับ เจ้านาย วันนี้มีอะไรให้ผมช่วยบ้างครับ')

    // Whole samples, some seconds of them, and not silence — the same three
    // questions the microphone test asks of a recording, from the other end.
    expect(heard.length % 2).toBe(0)
    expect(millisecondsOfAudio(heard.length, SAMPLE_RATE)).toBeGreaterThan(1000)
    expect(heard.some((byte) => byte !== 0)).toBe(true)
  })

  it('speaks Thai and English in the same breath', { timeout: 60_000 }, async () => {
    // The requirement ADR-0003 chose MiniMax for. "ไปแก้ bug ในโปรเจค X" is how
    // the Owner talks and so how T.O.E.Z. answers; a provider that needed one
    // voice per language could not say it at all.
    const heard = await synthesise('เดี๋ยวผมไปแก้ bug ในโปรเจคให้นะครับ Good evening.')

    expect(millisecondsOfAudio(heard.length, SAMPLE_RATE)).toBeGreaterThan(1000)
    expect(heard.some((byte) => byte !== 0)).toBe(true)
  })

  it('takes a second phrase down the same connection', { timeout: 60_000 }, async () => {
    // What lets a reply be spoken sentence by sentence without a gap where each
    // one starts. If MiniMax ever stops allowing it, the Voice provider opens a
    // fresh connection per phrase and this is where that shows up first.
    const socket = await MinimaxSocket.open(settings)

    try {
      const first = await collect(socket, 'ตอนนี้เก้าโมงเช้าครับ เจ้านาย')
      expect(socket.usable).toBe(true)

      const second = await collect(socket, 'อากาศข้างนอกกำลังดีเลยครับ')

      expect(first.length).toBeGreaterThan(0)
      expect(second.length).toBeGreaterThan(0)
      expect(second.some((byte) => byte !== 0)).toBe(true)
    } finally {
      socket.close()
    }
  })

  it('says plainly when the key is refused', { timeout: 60_000 }, async () => {
    // The failure the Owner is likeliest to meet, and the one that arrives with
    // the least explanation: a WebSocket refused during its handshake reports a
    // closed connection and nothing about why.
    await expect(
      MinimaxSocket.open({ ...settings, apiKey: 'not-a-key' }),
    ).rejects.toThrow(/MiniMax/)
  })

  /** One phrase, on a connection of its own. */
  async function synthesise(text: string): Promise<Buffer> {
    const socket = await MinimaxSocket.open(settings)
    try {
      return await collect(socket, text)
    } finally {
      socket.close()
    }
  }

  async function collect(socket: MinimaxSocket, text: string): Promise<Buffer> {
    const pieces: Buffer[] = []
    await socket.say(text, (audio) => pieces.push(audio))
    return Buffer.concat(pieces)
  }
})

describe('the speakers', () => {
  it('know when what they were given has been heard', { timeout: 30_000 }, async () => {
    // Silence, so that running the suite is not an event in the room. What is
    // under test is the clock, not the sound: the Session goes back to waiting
    // for the Owner on the strength of `untilQuiet`, so it has to be roughly
    // the length of the audio and not instant.
    const speakers = new Speakers(SAMPLE_RATE)
    const halfASecond = Buffer.alloc(SAMPLE_RATE)

    const at = performance.now()
    speakers.play(halfASecond)
    await speakers.untilQuiet()
    const waited = performance.now() - at
    await speakers.close()

    expect(waited).toBeGreaterThan(400)
    // Half a second of audio, plus the quarter ffplay takes to start, plus
    // room for a machine under load. Anything past this is not a slow start.
    expect(waited).toBeLessThan(3000)
  })
})
