import { join } from 'node:path'

import { defaultWorkspaceRoot } from '../../core/workspace/workspace.ts'

/**
 * Which model listens, and where they live. Inside the Workspace because they
 * are T.O.E.Z.'s, not the repo's: they are large, they are fetched or built
 * rather than written, and reinstalling the app should not mean getting them
 * again.
 *
 * There are two, because no single one is best at both languages the Owner
 * speaks — ADR-0006 has the recordings. docs/ears.md says how to get them.
 */

const modelsDirectory = join(defaultWorkspaceRoot, 'models')

/**
 * Thonburian Whisper, a Thai fine-tune. Far better on the Owner's Thai than
 * anything multilingual, and unable to hear English at all: it renders English
 * words inside a Thai sentence in Thai script, and given English on its own it
 * answers with fluent Thai nonsense (ADR-0004).
 *
 * Built by scripts/build-thonburian-model.sh — there is no ready-made ggml of
 * it to download.
 */
export const thaiModelPath = join(
  modelsDirectory,
  'ggml-whisper-th-medium-combined-q5_0.bin',
)

/**
 * Whisper large-v3-turbo. What listens for every language that is not Thai,
 * and the only one of the two that can hear English.
 */
export const multilingualModelPath = join(
  modelsDirectory,
  'ggml-large-v3-turbo-q5_0.bin',
)

/**
 * The model to listen with, given the language the Owner chose (ADR-0005).
 * Choosing the language is what makes this possible: nothing has to guess which
 * model to load, because the Owner has already said what they are speaking.
 */
export function modelPathFor(language: string): string {
  return language === 'th' ? thaiModelPath : multilingualModelPath
}

/**
 * Silero VAD. Without it Whisper invents words out of silence — an accidental
 * tap of Right ⌘ comes back as "you" rather than as nothing — so every
 * transcription runs through it first.
 */
export const defaultVadModelPath = join(modelsDirectory, 'ggml-silero-v5.1.2.bin')
