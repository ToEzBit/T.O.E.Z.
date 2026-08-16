import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { openWorkspace } from '../src/core/workspace/workspace.ts'

/**
 * The Workspace is T.O.E.Z.'s own home, apart from the app's code. These tests
 * drive it against a temporary directory rather than the real `~/.toez`.
 */
describe('the Workspace', () => {
  let root: string

  beforeEach(async () => {
    // A path inside a temp dir that does *not* exist yet: first run is the
    // interesting case, and a pre-made directory would skip it.
    root = join(await mkdtemp(join(tmpdir(), 'toez-')), 'workspace')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('bootstraps itself with a default Persona on first run', async () => {
    const workspace = await openWorkspace(root)

    expect(workspace.personaPath).toBe(join(root, 'persona.md'))
    expect(await readFile(workspace.personaPath, 'utf8')).toBe(workspace.persona)
    // The Persona is what makes T.O.E.Z. itself: it must at least know what to
    // call the Owner.
    expect(workspace.persona).toContain('เจ้านาย')
  })

  it("keeps the Owner's edits on every run after the first", async () => {
    const first = await openWorkspace(root)
    await writeFile(first.personaPath, 'พูดสั้น ๆ กับเจ้านาย\n', 'utf8')

    const second = await openWorkspace(root)

    expect(second.persona).toBe('พูดสั้น ๆ กับเจ้านาย\n')
  })

  it('refuses to open with an empty Persona rather than lose its character', async () => {
    const workspace = await openWorkspace(root)
    await writeFile(workspace.personaPath, '   \n', 'utf8')

    await expect(openWorkspace(root)).rejects.toThrow(/persona/i)
  })
})
