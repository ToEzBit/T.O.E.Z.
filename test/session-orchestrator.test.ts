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
    expect(transcriber.capturing).toBe(true)

    await session.dispatch({ type: 'hotkey-released' })
    expect(transcriber.capturing).toBe(false)

    expect(effects).toEqual<SessionEffect[]>([
      { type: 'start-capture' },
      { type: 'stop-capture' },
      { type: 'send-to-engine', request: { utterance: 'ทดสอบหน่อย' } },
      { type: 'speak', request: { text: 'สวัสดีครับ เจ้านาย' } },
    ])
    expect(engine.requests).toEqual([{ utterance: 'ทดสอบหน่อย' }])
    expect(voice.spoken).toEqual([{ text: 'สวัสดีครับ เจ้านาย' }])
  })

  it('carries on into a second turn once it has finished speaking', async () => {
    const engine = new ScriptedEngine([['Good evening.'], ['Nine o’clock.']])
    const transcriber = new CannedTranscriber(['Hello', 'What time is it?'])
    const voice = new RecordingVoice()
    const session = new SessionRuntime({ engine, transcriber, voice })

    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })
    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })

    expect(engine.requests).toEqual([
      { utterance: 'Hello' },
      { utterance: 'What time is it?' },
    ])
    expect(voice.spoken).toEqual([
      { text: 'Good evening.' },
      { text: 'Nine o’clock.' },
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
