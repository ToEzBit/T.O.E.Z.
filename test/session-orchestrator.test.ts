import { describe, expect, it } from 'vitest'

import type { SessionEffect } from '../src/core/session/effects.ts'
import { SessionRuntime } from '../src/core/session/session-runtime.ts'
import { CannedTranscriber } from '../src/core/testing/canned-transcriber.ts'
import { RecordingVoice } from '../src/core/testing/recording-voice.ts'
import { ScriptedEngine } from '../src/core/testing/scripted-engine.ts'

/**
 * The Session orchestrator is the one seam this project tests through: events
 * go in, effects come out, and nothing here reaches into its internals.
 *
 * This is the pattern every later ticket follows.
 */
describe('the Session orchestrator', () => {
  it('turns one push-to-talk turn into a spoken reply', async () => {
    const engine = new ScriptedEngine([['สวัสดี', 'ครับ เจ้านาย']])
    const transcriber = new CannedTranscriber(['ทดสอบหน่อย'])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    const effects = recordEffects(session)

    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })

    expect(effects).toEqual<SessionEffect[]>([
      { type: 'start-capture' },
      { type: 'stop-capture' },
      { type: 'show-utterance', utterance: { text: 'ทดสอบหน่อย' } },
      { type: 'send-to-engine', request: { utterance: { text: 'ทดสอบหน่อย' } } },
      { type: 'show-reply-chunk', chunk: { text: 'สวัสดี' } },
      { type: 'show-reply-chunk', chunk: { text: 'ครับ เจ้านาย' } },
      { type: 'speak', request: { text: 'สวัสดีครับ เจ้านาย' } },
    ])

    // The list above is what the Session decided; these are what actually
    // reached the providers.
    expect(engine.requests).toEqual([{ utterance: { text: 'ทดสอบหน่อย' } }])
    expect(voice.spoken).toEqual([{ text: 'สวัสดีครับ เจ้านาย' }])
  })

  it('shows each piece of the reply as it arrives, before speaking any of it', async () => {
    const engine = new ScriptedEngine([['Good ', 'evening, ', 'เจ้านาย']])
    const transcriber = new CannedTranscriber(['Hello'])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    const effects = recordEffects(session)

    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })

    // A reply arriving in one piece would still speak correctly; what the Panel
    // needs — and what T4 will speak from — is the pieces, in order.
    expect(effects.filter((effect) => effect.type === 'show-reply-chunk')).toEqual<
      SessionEffect[]
    >([
      { type: 'show-reply-chunk', chunk: { text: 'Good ' } },
      { type: 'show-reply-chunk', chunk: { text: 'evening, ' } },
      { type: 'show-reply-chunk', chunk: { text: 'เจ้านาย' } },
    ])
    expect(effects.at(-1)).toEqual<SessionEffect>({
      type: 'speak',
      request: { text: 'Good evening, เจ้านาย' },
    })
  })

  it('speaks the first sentence while the rest of the reply is still arriving', async () => {
    // The whole of T4: the Owner hears the answer beginning before the Engine
    // has finished writing it. Without this the wait is transcription plus the
    // whole reply plus synthesis, and a conversation cannot be had at that
    // length.
    const engine = new ScriptedEngine([['Good evening. ', 'Nine o’clock, เจ้านาย.']])
    const transcriber = new CannedTranscriber(['What time is it?'])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    const effects = recordEffects(session)

    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })

    expect(effects.slice(4)).toEqual<SessionEffect[]>([
      { type: 'show-reply-chunk', chunk: { text: 'Good evening. ' } },
      { type: 'speak', request: { text: 'Good evening.' } },
      { type: 'show-reply-chunk', chunk: { text: 'Nine o’clock, เจ้านาย.' } },
      { type: 'speak', request: { text: 'Nine o’clock, เจ้านาย.' } },
    ])
  })

  it('speaks every word of the reply exactly once', async () => {
    // The failure this guards against is speaking the sentences as they arrive
    // and then the whole reply again at the end, which is what the Session used
    // to do when the reply was only ever spoken once, at the end.
    const engine = new ScriptedEngine([['One. ', 'Two. ', 'Three.']])
    const transcriber = new CannedTranscriber(['Count to three.'])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })

    expect(voice.spoken).toEqual([
      { text: 'One.' },
      { text: 'Two.' },
      { text: 'Three.' },
    ])
  })

  it('breaks a Thai reply at a space, having no full stop to break at', async () => {
    // Thai does not end its sentences with a full stop — it puts a space where
    // another language puts one. A reply in the language T.O.E.Z. is normally
    // spoken to therefore contains nothing a sentence splitter would find, and
    // would be spoken only once it was complete: the case that matters most,
    // failing silently while English passed.
    const engine = new ScriptedEngine([
      [
        'ตอนนี้เก้าโมงเช้าครับ เจ้านาย ',
        'อากาศข้างนอกกำลังดี ลมเย็นสบาย ',
        'เหมาะกับการออกไปเดินเล่นมากครับ ',
        'เดี๋ยวผมเปิดหน้าต่างให้นะครับ',
      ],
    ])
    const transcriber = new CannedTranscriber(['ตอนนี้กี่โมงแล้ว'])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    const effects = recordEffects(session)

    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })

    expect(voice.spoken).toEqual([
      { text: 'ตอนนี้เก้าโมงเช้าครับ เจ้านาย อากาศข้างนอกกำลังดี ลมเย็นสบาย' },
      { text: 'เหมาะกับการออกไปเดินเล่นมากครับ เดี๋ยวผมเปิดหน้าต่างให้นะครับ' },
    ])
    // Said aloud before the last of the reply was written, which is the point.
    expect(effects.findIndex((effect) => effect.type === 'speak')).toBeLessThan(
      effects.findLastIndex((effect) => effect.type === 'show-reply-chunk'),
    )
  })

  it('does not mistake the point in a number for the end of a sentence', async () => {
    const engine = new ScriptedEngine([['It took about ', '2.5 ', 'seconds.']])
    const transcriber = new CannedTranscriber(['How long did that take?'])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })

    expect(voice.spoken).toEqual([{ text: 'It took about 2.5 seconds.' }])
  })

  it('says nothing when the reply is nothing but whitespace', async () => {
    const engine = new ScriptedEngine([['  ', '\n']])
    const transcriber = new CannedTranscriber(['Hello'])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })

    expect(voice.spoken).toEqual([])
  })

  it('carries on into a second turn once it has finished speaking', async () => {
    // The first turn is spoken in pieces and the second one is not, so this
    // also stands for the Session finding its way back to idle from either.
    const engine = new ScriptedEngine([['Good evening. ', 'All quiet.'], ['Nine o’clock.']])
    const transcriber = new CannedTranscriber(['Hello', 'What time is it?'])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })
    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })

    expect(engine.requests).toEqual([
      { utterance: { text: 'Hello' } },
      { utterance: { text: 'What time is it?' } },
    ])
    expect(voice.spoken).toEqual([
      { text: 'Good evening.' },
      { text: 'All quiet.' },
      { text: 'Nine o’clock.' },
    ])
  })

  it('lets a mis-tap of the key end the turn without waking the Engine', async () => {
    // Right ⌘ is a key the Owner also presses for other reasons. A tap that
    // caught no words must cost nothing: no Engine call, no speech, no Panel
    // showing an empty line where an Utterance should be.
    const engine = new ScriptedEngine([])
    const transcriber = new CannedTranscriber(['   '])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    const effects = recordEffects(session)

    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })

    expect(effects).toEqual<SessionEffect[]>([
      { type: 'start-capture' },
      { type: 'stop-capture' },
    ])
    expect(engine.requests).toEqual([])
    expect(voice.spoken).toEqual([])
  })

  it('is listening again straight after a mis-tap', async () => {
    // The proof that a mis-tap ended the turn rather than stranding it: the very
    // next press is heard.
    const engine = new ScriptedEngine([['Good evening.']])
    const transcriber = new CannedTranscriber(['', 'Hello'])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })
    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })

    expect(engine.requests).toEqual([{ utterance: { text: 'Hello' } }])
    expect(voice.spoken).toEqual([{ text: 'Good evening.' }])
  })

  it('survives a tap too quick for the microphone to have opened', async () => {
    // The Owner lets go when they let go, not when the Session is ready — and
    // the microphone takes about half a second to open. Both events are sent
    // here without waiting for the first, which is how they really arrive.
    const engine = new ScriptedEngine([['Good evening.']])
    const transcriber = new CannedTranscriber(['Hello'])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    const effects = recordEffects(session)

    await Promise.all([
      session.dispatch({ type: 'hotkey-pressed' }),
      session.dispatch({ type: 'hotkey-released' }),
    ])

    // The microphone is opened and closed in that order, once each: the release
    // waited for the press rather than closing a microphone still opening.
    expect(effects.map((effect) => effect.type)).toEqual([
      'start-capture',
      'stop-capture',
      'show-utterance',
      'send-to-engine',
      'show-reply-chunk',
      'speak',
    ])
  })

  it('ignores a key release that no key press opened', async () => {
    const engine = new ScriptedEngine([])
    const transcriber = new CannedTranscriber([])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    const effects = recordEffects(session)
    await session.dispatch({ type: 'hotkey-released' })

    expect(effects).toEqual([])
    expect(engine.requests).toEqual([])
    expect(voice.spoken).toEqual([])
  })
})

function recordEffects(session: SessionRuntime): SessionEffect[] {
  const effects: SessionEffect[] = []
  session.onEffect((effect) => effects.push(effect))
  return effects
}
