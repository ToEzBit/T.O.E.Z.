import { assertNever } from '../core/assert-never.ts'
import { SessionRuntime } from '../core/session/session-runtime.ts'
import { CannedTranscriber } from '../core/testing/canned-transcriber.ts'
import { MinimaxVoice } from '../providers/voice/minimax-voice.ts'
import { DictatingEngine } from './dictating-engine.ts'

/**
 * T.O.E.Z.'s mouth, on its own. A reply is written out at the speed the real
 * Engine writes one, and T.O.E.Z. says it aloud — starting, if this works,
 * well before the last word has been written.
 *
 * `pnpm say`, or `pnpm say "ข้อความที่อยากให้พูด"`. Nothing here asks the
 * Engine anything, so it spends no subscription tokens; it does spend MiniMax
 * characters, which is the whole point of it being a thing the Owner runs
 * rather than a test that runs itself.
 *
 * Two questions this is for, and no test can settle either: whether the Voice
 * sounds like something worth talking to in Thai, and whether the wait before
 * it starts is short enough to hold a conversation through. Setup — the API
 * key, the voice, ffplay — is docs/voice.md.
 */

const apiKey = process.env.MINIMAX_API_KEY
if (apiKey === undefined || apiKey === '') {
  process.stdout.write(
    `No MINIMAX_API_KEY.\n` +
      `Put it in a .env file at the root of this repo:\n` +
      `  MINIMAX_API_KEY=...\n` +
      `That file is git-ignored and must stay that way. See docs/voice.md.\n`,
  )
  process.exit(1)
}

/** What to say. A default that is Thai, English, and both in one breath. */
const words =
  process.argv[2] ??
  'สวัสดีครับ เจ้านาย ผมพร้อมพูดแล้วนะครับ ' +
    'ผมจะเริ่มพูดตั้งแต่ประโยคแรกที่คิดเสร็จ ไม่ต้องรอจนกว่าจะตอบจบทั้งหมด ' +
    'Good evening. This part is English, in the same voice and the same breath. ' +
    'แล้วก็กลับมาพูดไทยต่อได้เลยครับ เดี๋ยวลองสั่งงานอะไรก็ได้นะครับ'

const voice = new MinimaxVoice({
  apiKey,
  ...(process.env.TOEZ_VOICE === undefined ? {} : { voiceId: process.env.TOEZ_VOICE }),
  ...(process.env.TOEZ_VOICE_MODEL === undefined
    ? {}
    : { model: process.env.TOEZ_VOICE_MODEL }),
  // What every phrase cost. The first `รอ` is the number that decides whether
  // this feels like a conversation: everything else is speech the Owner is
  // already listening to.
  onSpoke: (spoken) =>
    process.stdout.write(
      `\n   🔊 ${spoken.text}\n` +
        `      รอ ${ms(spoken.waitedMs)} · เสียง ${ms(spoken.audioMs)}\n`,
    ),
})

const session = new SessionRuntime({
  engine: new DictatingEngine(words),
  transcriber: new CannedTranscriber(['พูดอะไรหน่อยสิครับ']),
  voice,
})

/** When the reply started being written, which is when the waiting started. */
let askedAt: number | undefined
/** When T.O.E.Z. first had something worth saying aloud. */
let firstPhraseAt: number | undefined

session.onEffect((effect) => {
  switch (effect.type) {
    case 'send-to-engine':
      askedAt = performance.now()
      process.stdout.write('\nT.O.E.Z. › ')
      break

    case 'show-reply-chunk':
      process.stdout.write(effect.chunk.text)
      break

    case 'speak':
      firstPhraseAt ??= performance.now()
      break

    case 'start-capture':
    case 'stop-capture':
    case 'show-utterance':
      // There is no microphone here and nothing was heard; the reply is what
      // this surface is about.
      break

    default:
      assertNever(effect, 'SessionEffect')
  }
})

process.stdout.write(
  `T.O.E.Z. — mouth only\n` +
    `Voice ${process.env.TOEZ_VOICE ?? 'the default one'}\n` +
    `Model ${process.env.TOEZ_VOICE_MODEL ?? 'the default one'}\n`,
)

try {
  await session.dispatch({ type: 'hotkey-pressed' })
  await session.dispatch({ type: 'hotkey-released' })

  process.stdout.write(
    `\n   ⏱ พูดคำแรกตอน ${took(askedAt, firstPhraseAt)} · ` +
      `ทั้งเทิร์น ${took(askedAt, performance.now())}\n`,
  )
} catch (error) {
  process.stdout.write(`\n\n💥 ${String(error)}\n`)
  await voice.close()
  process.exit(1)
}

// Waited for rather than exited over: closing plays out whatever is still in
// the speakers, and leaving before it does cuts off the last word.
await voice.close()
process.stdout.write('\nแล้วเจอกันครับ เจ้านาย\n')

/** How long from asking to `at` — or 'never', when that moment never came. */
function took(from: number | undefined, at: number | undefined): string {
  if (from === undefined || at === undefined) return 'never'
  return ms(at - from)
}

function ms(milliseconds: number): string {
  return milliseconds < 1000
    ? `${milliseconds.toFixed(0)}ms`
    : `${(milliseconds / 1000).toFixed(1)}s`
}
