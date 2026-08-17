import { execFile } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

/**
 * Two credentials exist in this project, and they are not kept the same way.
 *
 * The Claude subscription is not a key at all, and ADR-0002 says no API key
 * "exists anywhere in this project" — so that one is looked for in every file
 * on the disk, `.env` included. There is nowhere it would be acceptable.
 *
 * The MiniMax key is a real key and has to live somewhere (ADR-0003). It lives
 * in `.env`, which is git-ignored on purpose, so it is looked for in the files
 * git would carry: tracked ones, and untracked ones that are not ignored and so
 * are one `git add .` from being carried.
 *
 * Both are promises about the whole repository rather than about any module,
 * which is why they are checked by reading it. What the Engine does with the
 * environment it hands on is `subscription-auth.test.ts`.
 */
describe('credentials', () => {
  it('has no Anthropic API key anywhere in this project, .env included', async () => {
    const offenders: string[] = []

    for await (const file of everyFile()) {
      if (ALLOWED_TO_WRITE_ONE_DOWN.has(file)) continue
      offenders.push(...(await leaksIn(file, ANTHROPIC)))
    }

    expect(offenders).toEqual([])
  })

  it('has no MiniMax key in any file git would carry', async () => {
    const offenders: string[] = []

    for (const file of await filesGitWouldCarry()) {
      if (ALLOWED_TO_WRITE_ONE_DOWN.has(file)) continue
      offenders.push(...(await leaksIn(file, MINIMAX)))
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

const ANTHROPIC = [
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
] as const

const MINIMAX = [
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

interface Leak {
  readonly what: string
  readonly looksLike: RegExp
}

async function leaksIn(file: string, leaks: readonly Leak[]): Promise<string[]> {
  const contents = await readFile(file, 'utf8').catch(() => '')
  return leaks
    .filter((leak) => leak.looksLike.test(contents))
    .map((leak) => `${file}: ${leak.what}`)
}

const run = promisify(execFile)
const REPO = fileURLToPath(new URL('..', import.meta.url))
const NOT_OURS = new Set(['node_modules', '.git', 'out', 'dist', 'coverage', '.vite'])

/** Every file on the disk that is this project's, so nothing can hide in a corner. */
async function* everyFile(directory: string = REPO): AsyncIterable<string> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (NOT_OURS.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) yield* everyFile(path)
    else if (entry.isFile()) yield path
  }
}

/**
 * Asked of git rather than of the directory, which is the difference between a
 * secret that is in the repository and one that is merely on this machine.
 */
async function filesGitWouldCarry(): Promise<string[]> {
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
