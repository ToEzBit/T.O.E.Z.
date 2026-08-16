import { join } from 'node:path'

import { defaultWorkspaceRoot } from '../../core/workspace/workspace.ts'

/**
 * Where T.O.E.Z. keeps the two model files its ears need, and what they are
 * called. Inside the Workspace because they are T.O.E.Z.'s, not the repo's:
 * they are large, they are fetched rather than written, and reinstalling the
 * app should not mean downloading them again.
 *
 * scripts/fetch-ears-models.sh puts them here; docs/ears.md explains, and
 * ADR-0004 records why these two.
 */

export const modelsDirectory = join(defaultWorkspaceRoot, 'models')

/**
 * Whisper large-v3-turbo, quantized. The Owner speaks Thai, English, and both
 * in one sentence, and this is the only model measured to manage all three —
 * the Thai fine-tunes ADR-0003 chose turn out to have forgotten English
 * entirely (ADR-0004). `TOEZ_MODEL` points `pnpm listen` at another one.
 */
export const defaultModelPath = join(
  modelsDirectory,
  'ggml-large-v3-turbo-q5_0.bin',
)

/**
 * Silero VAD. Without it Whisper invents words out of silence — an accidental
 * tap of Right ⌘ comes back as "you" rather than as nothing — so every
 * transcription runs through it first.
 */
export const defaultVadModelPath = join(modelsDirectory, 'ggml-silero-v5.1.2.bin')
