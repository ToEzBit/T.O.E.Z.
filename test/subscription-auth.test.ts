import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { subscriptionOnlyEnv } from '../src/providers/engine/subscription-env.ts'

/**
 * ADR-0002 says T.O.E.Z. runs on the Owner's Claude subscription and that no
 * API key exists anywhere in this project. That is a promise about the whole
 * repository, not about one module, so it is checked here rather than left to
 * the Engine's own tests. The Engine also refuses at runtime to talk to
 * anything that is not OAuth; that half is proved in the integration suite,
 * which actually starts one.
 */
describe('subscription auth', () => {
  it('hands the Engine an environment with no API credentials in it', () => {
    const parent = {
      PATH: '/usr/bin',
      HOME: '/Users/owner',
      ANTHROPIC_API_KEY: 'sk-ant-nope',
      ANTHROPIC_AUTH_TOKEN: 'also-nope',
    }

    expect(subscriptionOnlyEnv(parent)).toEqual({
      PATH: '/usr/bin',
      HOME: '/Users/owner',
    })
    // The caller's own environment is left alone; only the subprocess's copy
    // is stripped.
    expect(parent.ANTHROPIC_API_KEY).toBe('sk-ant-nope')
  })

  it('strips them from this machine too, whatever is exported here', () => {
    // The one above proves the rule; this proves it against the environment the
    // Engine will actually hand over. Asserting that the ambient environment is
    // clean would be the wrong test: a machine with a key exported for some
    // other project is exactly the case this is meant to survive, not fail on.
    const handedOver = subscriptionOnlyEnv()

    expect(handedOver.ANTHROPIC_API_KEY).toBeUndefined()
    expect(handedOver.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(Object.keys(handedOver).length).toBeGreaterThan(0)
  })

  it('has no API key anywhere in the project', async () => {
    const offenders: string[] = []

    for await (const file of projectFiles()) {
      // This file is the one exception: it has to spell out what a leaked
      // credential looks like in order to go looking for one.
      if (file === fileURLToPath(import.meta.url)) continue

      const contents = await readFile(file, 'utf8').catch(() => '')
      // An assignment or a literal key — not the bare names, which the module
      // above has to mention in order to remove them.
      if (/ANTHROPIC_(API_KEY|AUTH_TOKEN)\s*[=:]\s*['"`]?\S/.test(contents)) {
        offenders.push(`${file}: assigns an Anthropic credential`)
      }
      if (/sk-ant-[a-z]/.test(contents)) {
        offenders.push(`${file}: contains something shaped like an API key`)
      }
    }

    expect(offenders).toEqual([])
  })
})

const REPO = fileURLToPath(new URL('..', import.meta.url))
const NOT_OURS = new Set(['node_modules', '.git', 'out', 'dist', 'coverage', '.vite'])

/** Every file this repository owns, so nothing can hide a key in a corner. */
async function* projectFiles(directory: string = REPO): AsyncIterable<string> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (NOT_OURS.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) yield* projectFiles(path)
    else if (entry.isFile()) yield path
  }
}
