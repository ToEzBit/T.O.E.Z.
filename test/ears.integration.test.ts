import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Microphone } from '../src/providers/transcriber/microphone.ts'
import {
  defaultModelPath,
  defaultVadModelPath,
} from '../src/providers/transcriber/models.ts'
import { Whisper } from '../src/providers/transcriber/whisper.ts'

/**
 * The ears' contract, against the real whisper.cpp and the real microphone.
 * The orchestrator's behaviour is proved with the canned fake in the fast
 * suite; what can only be proved here is that the thing behind the interface
 * hears Thai, hears English, and hears nothing in silence.
 *
 * Needs the setup in docs/ears.md: `brew install ffmpeg whisper-cpp`, the two
 * models, and — for the microphone test — permission to record.
 *
 * The voices are macOS's own, so the test speaks to itself. That is enough to
 * hold the wiring honest, and no substitute at all for the Owner's real voice:
 * whether the model hears *them* correctly is a question only they can answer,
 * with `pnpm listen`.
 */

const run = promisify(execFile)

describe('Whisper', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'toez-ears-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('hears Thai, and knows it was Thai', { timeout: 120_000 }, async () => {
    const wav = await speak('Kanya', 'สวัสดีครับ วันนี้อากาศดีนะ')

    const heard = await whisper().transcribe(wav)

    expect(heard.language).toBe('th')
    expect(heard.text).toContain('สวัสดี')
  })

  it('hears English, and knows it was English', { timeout: 120_000 }, async () => {
    // The one that chose the model. A Thai fine-tune fails this outright: asked
    // this question, `whisper-th-medium-combined` answers `สวัสดีค่ะ วันนี้
    // กฎหมายเป็นยังไงบ้าง` — fluent Thai with no relation to what was said, and
    // reported as Thai. ADR-0004 has the measurements.
    const wav = await speak('Samantha', 'Good evening. What is the weather like today?')

    const heard = await whisper().transcribe(wav)

    expect(heard.language).toBe('en')
    expect(heard.text).toMatch(/weather/i)
  })

  it('keeps English words in English inside a Thai sentence', { timeout: 120_000 }, async () => {
    // "ไปแก้ bug ในโปรเจค X" is how the Owner talks. What is asserted is only
    // that some Latin script survives, because that is the whole difference
    // between a multilingual model and a Thai one — the Thai fine-tunes render
    // "pnpm test" as `พี่เอ็นพี่เอ็มเทสต์`, which reaches the Engine as a wrong
    // utterance rather than an accented one.
    //
    // Which English word survives is not asserted, and could not honestly be:
    // Kanya is a Thai voice reading Latin text, so she says these with Thai
    // phonology. A person code-switching sounds different. So this catches a
    // model that has lost English altogether — the regression that actually
    // happened — and says nothing about how well the rest was heard. Only the
    // Owner on `pnpm listen` can answer that.
    const wav = await speak('Kanya', 'ช่วยเปิด terminal แล้วรัน pnpm test ให้หน่อยครับ')

    const heard = await whisper().transcribe(wav)

    expect(heard.text).toMatch(/[A-Za-z]/)
  })

  it('hears nothing at all in silence', { timeout: 120_000 }, async () => {
    // The one that matters most for turn-taking. Asked to transcribe silence,
    // Whisper on its own invents a word — ggml-base returns "you" — and that
    // invention would reach the Engine as something the Owner said. Voice
    // activity detection is what keeps a mis-tap of Right ⌘ costing nothing.
    const wav = join(directory, 'silence.wav')
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono',
      '-t', '2', '-c:a', 'pcm_s16le', '-y', wav,
    ])

    const heard = await whisper().transcribe(wav)

    expect(heard.text).toBe('')
  })

  function whisper(): Whisper {
    return new Whisper({
      modelPath: process.env.TOEZ_MODEL ?? defaultModelPath,
      vadModelPath: defaultVadModelPath,
      language: 'auto',
    })
  }

  /** macOS speaking, in the same format the microphone records in. */
  async function speak(voice: string, words: string): Promise<string> {
    const wav = join(directory, `${voice}.wav`)
    await run('say', [
      '-v', voice,
      '-o', wav,
      '--data-format=LEI16@16000',
      words,
    ]).catch((error: unknown) => {
      throw new Error(
        `macOS could not speak as ${voice}. Add the voice under System ` +
          `Settings › Accessibility › Spoken Content › System Voice.\n${String(error)}`,
      )
    })
    return wav
  }
})

describe('the microphone', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'toez-mic-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('records the room between opening and closing', { timeout: 30_000 }, async () => {
    const wav = join(directory, 'held.wav')
    const microphone = new Microphone()

    await microphone.open(wav)
    // `open` resolving is the claim under test: that it waits for the device
    // rather than for the process, so audio from here on is really captured.
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await microphone.close()

    const header = await readFile(wav)
    expect(header.subarray(0, 4).toString()).toBe('RIFF')
    // What whisper.cpp wants, so that nothing has to resample it: mono, 16 kHz.
    expect(header.readUInt16LE(22)).toBe(1)
    expect(header.readUInt32LE(24)).toBe(16_000)

    // Around a second of it. Generous at both ends: this is measuring a real
    // device, not a clock.
    const seconds = (header.length - 44) / (16_000 * 2)
    expect(seconds).toBeGreaterThan(0.5)
    expect(seconds).toBeLessThan(2)
  })
})
