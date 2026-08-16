import { access } from 'node:fs/promises'

import { assertNever } from '../core/assert-never.ts'
import type { SessionEvent } from '../core/session/events.ts'
import { SessionRuntime } from '../core/session/session-runtime.ts'
import { PushToTalk } from '../providers/hotkey/push-to-talk.ts'
import {
  defaultModelPath,
  defaultVadModelPath,
} from '../providers/transcriber/models.ts'
import { WhisperTranscriber } from '../providers/transcriber/whisper-transcriber.ts'
import { MuteEngine } from './mute-engine.ts'
import { MuteVoice } from './mute-voice.ts'

/**
 * T.O.E.Z.'s ears, on their own. Hold Right ⌘, speak Thai or English or both,
 * release, and read what it heard. Nothing answers: the Engine and the Voice
 * are stand-ins, because the only question this surface exists to ask is
 * whether it heard the Owner right.
 *
 * `pnpm listen`. Ctrl-C ends it.
 *
 * Setup — ffmpeg, whisper-cli, the models, and the two macOS permissions — is
 * docs/ears.md.
 */

// Two knobs, because which of them the Owner's own voice prefers is exactly
// what this surface is for finding out. Settings proper arrive in T11.
const modelPath = process.env.TOEZ_MODEL ?? defaultModelPath
const language = process.env.TOEZ_LANGUAGE ?? 'auto'

// A missing model otherwise surfaces as a whisper-cli failure three quarters of
// the way through the Owner's first sentence.
for (const path of [modelPath, defaultVadModelPath]) {
  await access(path).catch(() => {
    process.stdout.write(
      `No model at ${path}\n` +
        `Run scripts/fetch-ears-models.sh — see docs/ears.md.\n`,
    )
    process.exit(1)
  })
}

/** When the microphone actually opened, which is when recording actually began. */
let listeningAt: number | undefined
/** When the key came up, which is when transcription began. */
let releasedAt: number | undefined

const session = new SessionRuntime({
  engine: new MuteEngine(),
  transcriber: new WhisperTranscriber({
    modelPath,
    vadModelPath: defaultVadModelPath,
    language,
    // The microphone takes about half a second to open, so this — not the
    // keypress — is the moment the Owner can start talking.
    onListening: () => {
      listeningAt = performance.now()
      process.stdout.write('   🎙  ฟังอยู่ครับ\n')
    },
    // Which language Whisper decided on is the evidence for whether `auto` is
    // the right setting for this Owner, so it goes on the screen every turn.
    onHeard: (heard) =>
      process.stdout.write(`   [${heard.language} · ถอดความ ${since(releasedAt)}]\n`),
  }),
  voice: new MuteVoice(),
})

session.onEffect((effect) => {
  switch (effect.type) {
    case 'start-capture':
      // Deliberately quiet: the microphone is not open yet. `onListening`
      // above is what tells the Owner to speak.
      break

    case 'stop-capture':
      process.stdout.write(`   ⏹  อัดได้ ${since(listeningAt)}\n`)
      break

    case 'show-utterance':
      process.stdout.write(`\nเจ้านาย › ${effect.utterance.text}\n`)
      break

    case 'send-to-engine':
    case 'show-reply-chunk':
    case 'speak':
      // There is no Engine and no Voice here, and an empty turn has nothing to
      // show. What a real reply looks like is `pnpm ask`.
      break

    default:
      assertNever(effect, 'SessionEffect')
  }
})

// A key event is not something that can be awaited at — the Owner presses when
// they press. The Session queues them; all that is left here is to notice when
// one of them fails.
function dispatch(event: SessionEvent): void {
  session.dispatch(event).catch((error: unknown) => {
    // The Session has no way to recover from this yet: a provider failure
    // becomes a SessionEvent in a later ticket, and until then the Session is
    // left mid-turn with nothing that can move it on.
    process.stdout.write(`\n💥 ${String(error)}\n`)
    stop(1)
  })
}

const stopListening = new PushToTalk().listen({
  pressed: () => {
    listeningAt = undefined
    dispatch({ type: 'hotkey-pressed' })
  },
  released: () => {
    releasedAt = performance.now()
    dispatch({ type: 'hotkey-released' })
  },
})

function stop(code: number): never {
  stopListening()
  process.stdout.write('\nแล้วเจอกันครับ เจ้านาย\n')
  process.exit(code)
}

process.on('SIGINT', () => {
  stop(0)
})

process.stdout.write(
  `T.O.E.Z. — ears only\n` +
    `Model    ${modelPath}\n` +
    `Language ${language}\n\n` +
    `Hold Right ⌘, speak, release. Ctrl-C to stop.\n` +
    `Nothing happening? macOS needs this terminal ticked under\n` +
    `System Settings › Privacy & Security › Accessibility.\n`,
)

/** How long since `from` — or 'never', when that moment never came. */
function since(from: number | undefined): string {
  if (from === undefined) return 'never'
  return `${((performance.now() - from) / 1000).toFixed(1)}s`
}
