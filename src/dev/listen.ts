import { access } from 'node:fs/promises'

import { assertNever } from '../core/assert-never.ts'
import type { SessionEvent } from '../core/session/events.ts'
import { SessionRuntime } from '../core/session/session-runtime.ts'
import {
  defaultPushToTalkKey,
  PushToTalk,
} from '../providers/hotkey/push-to-talk.ts'
import {
  defaultModelPath,
  defaultVadModelPath,
} from '../providers/transcriber/models.ts'
import { WhisperTranscriber } from '../providers/transcriber/whisper-transcriber.ts'
import { MuteEngine } from './mute-engine.ts'
import { MuteVoice } from './mute-voice.ts'

/**
 * T.O.E.Z.'s ears, on their own. Hold the push-to-talk key, speak Thai or
 * English or both, release, and read what it heard. Nothing answers: the Engine
 * and the Voice are stand-ins, because the only question this surface exists to
 * ask is whether it heard the Owner right.
 *
 * `pnpm listen`. Ctrl-C ends it. `TOEZ_LANGUAGE` is the one worth reaching for:
 * `en` for an English session, `auto` to let Whisper guess again.
 *
 * Run by Electron rather than by Node, which `pnpm ask` uses — not for anything
 * Electron provides, but for the Node inside it. The keyboard hook delivers one
 * event on Node 26 and then goes deaf; on Electron's Node 24 it keeps working.
 * Electron strips the types itself, so there is still no bundler in the way.
 * That also means macOS asks for the microphone and for Accessibility on
 * Electron's behalf, not the terminal's.
 *
 * Setup — ffmpeg, whisper-cli, the models, and the two macOS permissions — is
 * docs/ears.md.
 */

// The knobs, because which of them the Owner's own voice, ears and hands prefer
// is exactly what this surface is for finding out. Settings proper arrive in
// T11.
const modelPath = process.env.TOEZ_MODEL ?? defaultModelPath
// Thai unless told otherwise, and never detected by default. See ADR-0005: the
// Owner speaks Thai to T.O.E.Z. through AirPods, and Whisper asked to guess at
// two seconds of that answered Korean.
const language = process.env.TOEZ_LANGUAGE ?? 'th'
const key = process.env.TOEZ_KEY ?? defaultPushToTalkKey
// Recordings are deleted as soon as they are transcribed unless this says where
// to keep them. Set it when a transcript comes back wrong: a bad microphone and
// a misheard word look identical in text and quite different in the ear.
const keepRecordingsIn = process.env.TOEZ_KEEP_AUDIO

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
    ...(keepRecordingsIn === undefined ? {} : { keepRecordingsIn }),
    // The microphone takes about half a second to open, so this — not the
    // keypress — is the moment the Owner can start talking.
    onListening: () => {
      listeningAt = performance.now()
      process.stdout.write('   🎙  ฟังอยู่ครับ\n')
    },
    // A turn that caught no speech says so. It is otherwise indistinguishable
    // from a turn that went wrong, and it reports whatever language Whisper
    // fell back to — `en` on a recording with nothing in it, which reads as a
    // bug when the Owner asked for Thai.
    //
    // The language on the other lines is what makes a run evidence: with one
    // chosen it confirms what was asked for, and under `auto` it is the whole
    // story, because guessing wrong is what makes Thai come back as Korean.
    onHeard: (heard) =>
      process.stdout.write(
        heard.text === ''
          ? `   [ไม่ได้ยินเสียงพูด · ${since(releasedAt)}]\n`
          : `   [${heard.language} · ถอดความ ${since(releasedAt)}]\n`,
      ),
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

const pushToTalk = new PushToTalk({ key })

const stopListening = pushToTalk.listen({
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
    `Language ${language}\n` +
    `Key      ${key}\n` +
    (keepRecordingsIn === undefined ? '' : `Keeping  ${keepRecordingsIn}\n`) +
    `\n` +
    `Hold the key, speak, release. Ctrl-C to stop.\n` +
    `Nothing happening? macOS needs Electron — not the terminal — ticked under\n` +
    `System Settings › Privacy & Security › Accessibility. See docs/ears.md.\n`,
)

/** How long since `from` — or 'never', when that moment never came. */
function since(from: number | undefined): string {
  if (from === undefined) return 'never'
  return `${((performance.now() - from) / 1000).toFixed(1)}s`
}
