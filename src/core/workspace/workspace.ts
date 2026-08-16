import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { DEFAULT_PERSONA } from './default-persona.ts'

/**
 * The Workspace is T.O.E.Z.'s own home: `~/.toez`, deliberately outside this
 * repo so it survives reinstalling the app. Persona now; Memory, Transcripts,
 * skills, MCP config and Registered Projects as later tickets add them.
 *
 * Node's `fs` only — no Electron — so the Engine can open the Workspace in
 * tests and in the dev CLI without an app running.
 */

export interface Workspace {
  /** Where everything T.O.E.Z. keeps for itself lives. */
  readonly root: string
  /** The editable document that defines the Persona. */
  readonly personaPath: string
  /** The Persona as it currently reads on disk. */
  readonly persona: string
}

/** The one real Workspace. Tests and experiments pass their own root instead. */
export const defaultWorkspaceRoot = join(homedir(), '.toez')

/**
 * Opens the Workspace, creating it with the default Persona if this is the
 * first run. Reads the Persona every time, so an edit the Owner made between
 * Sessions takes effect on the next one.
 */
export async function openWorkspace(
  root: string = defaultWorkspaceRoot,
): Promise<Workspace> {
  const personaPath = join(root, 'persona.md')

  await mkdir(root, { recursive: true })
  // `wx` is the whole of "first run": it writes only when nothing is there, so
  // two Sessions starting at once cannot overwrite an edited Persona between
  // them.
  await writeFile(personaPath, DEFAULT_PERSONA, { encoding: 'utf8', flag: 'wx' }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error
    },
  )

  const persona = await readFile(personaPath, 'utf8')
  if (persona.trim() === '') {
    throw new Error(
      `The Persona at ${personaPath} is empty. T.O.E.Z. without a Persona is ` +
        `not T.O.E.Z.; delete the file to get the default one back.`,
    )
  }

  return { root, personaPath, persona }
}
