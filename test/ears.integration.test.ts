import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Microphone } from '../src/providers/transcriber/microphone.ts'
import {
  defaultVadModelPath,
  modelPathFor,
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

  it('hears Thai', { timeout: 120_000 }, async () => {
    const wav = await speak('Kanya', 'สวัสดีครับ วันนี้อากาศดีนะ')

    const heard = await whisper('th').transcribe(wav)

    expect(heard.language).toBe('th')
    expect(heard.text).toContain('สวัสดี')
  })

  it('hears English, with the model English goes to', { timeout: 120_000 }, async () => {
    // Why there are two models rather than one. Given this recording, the Thai
    // fine-tune answers `สวัสดีค่ะ วันนี้กฎหมายเป็นยังไงบ้าง` — fluent Thai
    // with no relation to what was said, reported as Thai. ADR-0004 measured
    // it; ADR-0006 is why the language picks which model hears it.
    const wav = await speak('Samantha', 'Good evening. What is the weather like today?')

    const heard = await whisper('en').transcribe(wav)

    expect(heard.language).toBe('en')
    expect(heard.text).toMatch(/weather/i)
  })

  it('hears the Thai around an English word', { timeout: 120_000 }, async () => {
    // "ไปแก้ bug ในโปรเจค X" is how the Owner talks, and it goes to the Thai
    // model like any other Thai. What is asserted is the Thai, because that is
    // what has to be right: the English word comes back transliterated —
    // `เทอร์มินัล` for "terminal" — which ADR-0006 accepts. A Thai reader
    // recognises that word; `เธอมินาเอา`, which is what the multilingual model
    // made of the Owner saying it, is not a word at all.
    const wav = await speak('Kanya', 'ช่วยเปิด terminal ให้หน่อยครับ')

    const heard = await whisper('th').transcribe(wav)

    expect(heard.text).toContain('ช่วยเปิด')
    expect(heard.text).toContain('ให้หน่อยครับ')
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

    const heard = await whisper('th').transcribe(wav)

    expect(heard.text).toBe('')
  })

  /** The same pairing of language to model that `pnpm listen` uses. */
  function whisper(language: string): Whisper {
    return new Whisper({
      modelPath: modelPathFor(language),
      vadModelPath: defaultVadModelPath,
      language,
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
    // `open` resolving is the claim under test: that it waits for the device to
    // be sending audio, so anything said from here on is really captured.
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await microphone.close()

    const recording = await readFile(wav)
    expect(recording.subarray(0, 4).toString()).toBe('RIFF')
    // What whisper.cpp wants, so that nothing has to resample it: mono, 16 kHz.
    expect(recording.readUInt16LE(22)).toBe(1)
    expect(recording.readUInt32LE(24)).toBe(16_000)

    // The header has to be exactly this long, or audio read at this offset is
    // really the header's own text — which is how a version string once passed
    // for sound and let the check below succeed on a silent recording.
    expect(recording.indexOf(Buffer.from('data')) + 8).toBe(44)

    // The one that matters, and the one whose absence hid a real bug: a
    // recording of the right length and format, made entirely of zeroes. A
    // Bluetooth headset sends nothing for its first two or three seconds while
    // ffmpeg dutifully writes silence, so the Owner was told to speak into a
    // microphone that could not yet hear them.
    //
    // The second the Owner was invited to speak into is the last one, not the
    // first: everything before `open` resolved may legitimately be the device
    // waking up. No room is silent to the last bit, so any non-zero sample in
    // that second means it was really being heard.
    const audio = recording.subarray(44)
    const lastSecond = audio.subarray(-16_000 * 2)
    expect(lastSecond.some((byte) => byte !== 0)).toBe(true)

    // At least the second that was waited out. No upper bound worth asserting:
    // the rest is however long the device took to wake up.
    expect(audio.length / (16_000 * 2)).toBeGreaterThan(0.9)
  })
})
