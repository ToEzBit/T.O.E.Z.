import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

/**
 * Two credentials exist in this project and neither may ever be written down in
 * it: the Owner's Claude subscription, which ADR-0002 keeps as an OAuth login
 * and never as an API key, and the MiniMax key the Voice speaks through
 * (ADR-0003), which is a real key and therefore lives in the environment.
 *
 * That is a promise about the whole repository rather than about any one
 * module, so it is checked by reading the repository. What the Engine does with
 * the environment it hands on is `subscription-auth.test.ts`.
 *
 * Every file git would carry, and no others: `.env` sits in this directory and
 * is deliberately ignored, so it is not part of the repository and finding a
 * key in it is not a failure. Untracked files that are *not* ignored count,
 * because they are one `git add .` from being carried.
 */
describe('credentials', () => {
  it('are nowhere in this repository', async () => {
    const offenders: string[] = []

    for (const file of await repositoryFiles()) {
      if (ALLOWED_TO_WRITE_ONE_DOWN.has(file)) continue

      const contents = await readFile(file, 'utf8').catch(() => '')
      for (const { what, looksLike } of LEAKS) {
        if (looksLike.test(contents)) offenders.push(`${file}: ${what}`)
      }
    }

    expect(offenders).toEqual([])
  })
})

/**
 * The two files that have to write a credential down in order to say anything
 * about credentials: this one, which spells out what a leaked one looks like in
 * order to go looking for it, and the one that proves an inherited API key is
 * taken away from the Engine's subprocess.
 */
const ALLOWED_TO_WRITE_ONE_DOWN = new Set([
  fileURLToPath(import.meta.url),
  fileURLToPath(new URL('subscription-auth.test.ts', import.meta.url)),
])

const LEAKS = [
  {
    what: 'assigns an Anthropic credential',
    // An assignment or a literal key — not the bare names, which
    // `subscription-env.ts` has to mention in order to remove them.
    looksLike: /ANTHROPIC_(API_KEY|AUTH_TOKEN)\s*[=:]\s*['"`]?\S/,
  },
  {
    what: 'contains something shaped like an Anthropic API key',
    looksLike: /sk-ant-[a-z]/,
  },
  {
    what: 'assigns the MiniMax key',
    // Long enough to be a key rather than the `MINIMAX_API_KEY=...` that
    // docs/voice.md tells the Owner to write in a file it never reads.
    looksLike: /MINIMAX_API_KEY\s*[=:]\s*['"`]?[\w.-]{20,}/,
  },
  {
    what: 'contains something shaped like a MiniMax key',
    // MiniMax hands out JSON web tokens, which are three dotted words of
    // base64 and always start the same way.
    looksLike: /eyJ[\w-]{10,}\.[\w-]{10,}\./,
  },
] as const

const run = promisify(execFile)
const REPO = fileURLToPath(new URL('..', import.meta.url))

/**
 * Every file this repository would carry, asked of git rather than of the
 * directory — which is the difference between a secret that is in the project
 * and a secret that is merely on this machine.
 */
async function repositoryFiles(): Promise<string[]> {
  const { stdout } = await run(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: REPO },
  )
  return stdout
    .split('\0')
    .filter((path) => path !== '')
    .map((path) => join(REPO, path))
}
