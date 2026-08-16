import { join } from 'node:path'

import { defaultWorkspaceRoot } from '../../core/workspace/workspace.ts'

/**
 * Where T.O.E.Z. keeps the two model files its ears need, and what they are
 * called. Inside the Workspace because they are T.O.E.Z.'s, not the repo's:
 * they are large, they are fetched rather than written, and reinstalling the
 * app should not mean downloading them again.
 *
 * scripts/build-thonburian-model.sh puts them here; docs/ears.md explains.
 */

export const modelsDirectory = join(defaultWorkspaceRoot, 'models')

/**
 * Thonburian Whisper, distilled and quantized — the variant ADR-0003 calls for
 * first, so that the ears fit alongside Electron on an M1 Pro with 16GB.
 */
export const defaultModelPath = join(
  modelsDirectory,
  'ggml-thonburian-distil-medium-q5_0.bin',
)

/**
 * Silero VAD. Without it Whisper invents words out of silence — an accidental
 * tap of Right ⌘ comes back as "you" rather than as nothing — so every
 * transcription runs through it first.
 */
export const defaultVadModelPath = join(modelsDirectory, 'ggml-silero-v5.1.2.bin')
