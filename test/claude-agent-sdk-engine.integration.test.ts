import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ReplyChunk } from '../src/core/ports/engine.ts'
import { openWorkspace, type Workspace } from '../src/core/workspace/workspace.ts'
import { ClaudeAgentSdkEngine } from '../src/providers/engine/claude-agent-sdk-engine.ts'

/**
 * The Engine's contract, against the real Claude Agent SDK: a Session that
 * spends real subscription tokens and needs the Owner to be logged in. The
 * orchestrator's behaviour is proved with the scripted fake in the fast suite;
 * what can only be proved here is that the thing behind the interface actually
 * streams, stays in character, and remembers.
 *
 * Kept to one Session with two turns on purpose — subscription usage is a
 * shared budget, and a test suite is a poor place to spend it.
 */
describe('the Claude Agent SDK Engine', () => {
  let root: string
  let workspace: Workspace

  beforeEach(async () => {
    // Its own Workspace, so the test reads the default Persona rather than
    // whatever the Owner has since written in `~/.toez`.
    root = join(await mkdtemp(join(tmpdir(), 'toez-engine-')), 'workspace')
    workspace = await openWorkspace(root)
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it(
    'streams a reply in character, and remembers it on the next turn',
    { timeout: 240_000 },
    async () => {
      const engine = new ClaudeAgentSdkEngine(workspace)

      const greeting = await collect(
        engine.reply({
          utterance: { text: 'จำเลข 41 ไว้นะ แล้วทักทายผมสั้น ๆ หน่อย' },
        }),
      )

      // Streaming is the point: a reply that arrived whole would be one chunk.
      expect(greeting.length).toBeGreaterThan(1)
      // The default Persona decides both of these: Thai in, Thai out, and the
      // Owner is เจ้านาย.
      expect(greeting.join('')).toMatch(THAI)
      expect(greeting.join('')).toContain('เจ้านาย')

      const remembered = await collect(
        engine.reply({ utterance: { text: 'เลขอะไรที่ผมให้จำไว้' } }),
      )

      // The second turn knows what the first one was told, which is the whole
      // of a Session being a conversation rather than a series of questions.
      expect(remembered.join('')).toContain('41')
    },
  )

  it('answers an English Owner in English', { timeout: 240_000 }, async () => {
    // A Session of its own. Asked as a follow-up inside the Thai Session above,
    // this comes back in Thai about as often as in English: what the Engine has
    // been speaking so far outweighs the Persona's language rule. A Session
    // opened in English stays in English, which is what the design asks for.
    const engine = new ClaudeAgentSdkEngine(workspace)

    const reply = await collect(
      engine.reply({ utterance: { text: 'Good evening. Who are you?' } }),
    )

    // เจ้านาย is how the Owner is addressed in either language, so it is not
    // evidence of a Thai reply; anything else in Thai script is.
    expect(reply.join('').replaceAll('เจ้านาย', '')).not.toMatch(THAI)
  })
})

/** Any Thai character. */
const THAI = /[฀-๿]/

async function collect(chunks: AsyncIterable<ReplyChunk>): Promise<string[]> {
  const texts: string[] = []
  for await (const chunk of chunks) texts.push(chunk.text)
  return texts
}
