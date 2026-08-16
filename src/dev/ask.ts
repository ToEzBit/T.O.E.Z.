import { createInterface } from 'node:readline/promises'

import { SessionRuntime } from '../core/session/session-runtime.ts'
import { openWorkspace } from '../core/workspace/workspace.ts'
import { ClaudeAgentSdkEngine } from '../providers/engine/claude-agent-sdk-engine.ts'
import { PrintingVoice } from './printing-voice.ts'
import { TypedTranscriber } from './typed-transcriber.ts'

/**
 * One real Session, driven from the keyboard. This is how the Engine gets
 * exercised before there are ears or a mouth: the same orchestrator, the same
 * Workspace, the same subscription auth — only the Transcriber and the Voice
 * are stood in for.
 *
 * `pnpm ask`. Ctrl-D ends the Session.
 */

const workspace = await openWorkspace()
const readline = createInterface({ input: process.stdin, output: process.stdout })

readline.on('close', () => {
  process.stdout.write('\nแล้วเจอกันครับ เจ้านาย\n')
  process.exit(0)
})

const session = new SessionRuntime({
  engine: new ClaudeAgentSdkEngine(workspace),
  transcriber: new TypedTranscriber(() => readline.question('\nเจ้านาย › ')),
  voice: new PrintingVoice(),
})

// Two numbers worth watching: how long the Owner waits before hearing anything
// at all, and how long the whole turn took. The first is the one that decides
// whether this feels like a conversation.
let askedAt = 0
let firstChunkAt = 0

session.onEffect((effect) => {
  switch (effect.type) {
    case 'send-to-engine':
      askedAt = performance.now()
      firstChunkAt = 0
      process.stdout.write('\nT.O.E.Z. › ')
      break

    case 'show-reply-chunk':
      firstChunkAt ||= performance.now()
      process.stdout.write(effect.chunk.text)
      break

    case 'speak':
      process.stdout.write(
        `\n   ⏱ first word ${since(askedAt, firstChunkAt)}, whole turn ${since(askedAt, performance.now())}\n`,
      )
      break

    default:
      break
  }
})

process.stdout.write(`T.O.E.Z. — Workspace at ${workspace.root}\n`)
process.stdout.write(`Persona from ${workspace.personaPath}\n`)

for (;;) {
  try {
    await session.dispatch({ type: 'hotkey-pressed' })
    await session.dispatch({ type: 'hotkey-released' })
  } catch (error) {
    // The Session has no way to recover from this yet: an Engine failure
    // becomes a SessionEvent in a later ticket, and until then the Session is
    // left mid-turn with nothing that can move it on.
    process.stdout.write(`\n\n💥 ${String(error)}\n`)
    readline.close()
    process.exit(1)
  }
}

function since(from: number, to: number): string {
  if (to === 0) return 'never'
  return `${(to - from).toFixed(0)}ms`
}
