/**
 * Breaking a reply, as it streams, into pieces that can be spoken on their own.
 *
 * This is what lets the Owner hear the beginning of an answer while the Engine
 * is still writing the end of it. Everything else about T4 follows from it: a
 * Voice that is handed the whole reply can only start speaking once the reply
 * exists, and the wait is then transcription plus the whole reply plus
 * synthesis.
 *
 * The hard part is not English. English marks the end of a sentence with a full
 * stop, and a splitter that looks for one works — on English. Thai, which is
 * the language T.O.E.Z. is normally spoken to, has no sentence-final
 * punctuation at all: it puts a **space** where another language puts a full
 * stop. So a full-stop splitter finds nothing in a Thai reply, speaks it in one
 * piece at the end, and passes every English test while failing the case that
 * matters.
 */

/**
 * How long a piece may get before it is broken at a space.
 *
 * One number, for both languages, and the only one here worth tuning by ear —
 * `pnpm say` is where that is done. Larger sounds better and starts later: a
 * piece is synthesised as a unit, so each break is a place the voice can put a
 * small pause it did not mean. Smaller starts sooner.
 *
 * Eighty is chosen so that ordinary spoken English reaches its full stop first
 * — the Persona is told to write short sentences, to be heard — while Thai,
 * which will never reach one, still starts within a sentence or two.
 */
const PHRASE_LIMIT = 80

/**
 * What ends a sentence, when one is written in a language that ends them.
 *
 * Only counted when whitespace follows, which is what keeps the point in "2.5"
 * from being read as a full stop. The cost is that a terminator at the very end
 * of the text so far waits for the next chunk to prove itself — and at the end
 * of a reply nothing more arrives, so the caller speaks what is left over.
 */
const TERMINATORS = '.!?…'

export interface Phrases {
  /** Ready to be spoken, in order. Trimmed, and never empty strings. */
  readonly phrases: readonly string[]
  /** What is left over, to be kept until more of the reply arrives. */
  readonly rest: string
}

/**
 * Takes everything from `text` that can be spoken now, leaving the rest for the
 * next chunk. Pure and total: the same text always breaks the same way, and
 * text that cannot be broken yet comes straight back as `rest`.
 */
export function takePhrases(text: string): Phrases {
  const phrases: string[] = []
  let rest = text

  for (;;) {
    const cut = cutPoint(rest)
    if (cut === undefined) break
    const phrase = rest.slice(0, cut).trim()
    rest = rest.slice(cut).trimStart()
    // A break can leave nothing in front of it — the newline in a blank line
    // between paragraphs, say. There is nothing there to speak.
    if (phrase !== '') phrases.push(phrase)
  }

  return { phrases, rest }
}

/**
 * Where to break, or `undefined` to wait for more. Always past the first
 * character, so that taking a phrase always makes progress.
 */
function cutPoint(text: string): number | undefined {
  const sentence = endOfSentence(text)
  if (sentence !== undefined) return sentence
  // Below the limit there is no hurry: waiting may yet turn this into a whole
  // sentence, which is a better thing to speak than part of one.
  if (text.trim().length <= PHRASE_LIMIT) return undefined
  return endOfPhrase(text)
}

/**
 * The end of the first finished sentence in `text`, counting a line break as
 * one — a reply that starts a new line has ended whatever was on the last one.
 */
function endOfSentence(text: string): number | undefined {
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') return index + 1
    if (!isTerminator(text[index])) continue
    // Run past "..." and "?!" so the whole of it is spoken as one thing.
    let end = index
    while (isTerminator(text[end + 1])) end += 1
    // Whitespace after is the proof that a sentence ended rather than a decimal
    // point or an abbreviation being written. Nothing after is not proof yet.
    const next = text[end + 1]
    if (next !== undefined && /\s/.test(next)) return end + 1
    index = end
  }
  return undefined
}

/** Past the end of the text is not a terminator — which is not what an empty
 * string means to `String.includes`, and the difference is an endless loop. */
function isTerminator(character: string | undefined): boolean {
  return character !== undefined && TERMINATORS.includes(character)
}

/**
 * The last space in `text`, which in Thai is where one thought ends and the
 * next begins, and in any language is a place a voice can pause without
 * sounding as though it were cut off. The last rather than the first, because
 * everything before it is whole words while whatever follows may still be half
 * of one, mid-stream.
 *
 * `undefined` when there is no space to break at — Thai written without them
 * runs on, and speaking half a word is worse than waiting.
 */
function endOfPhrase(text: string): number | undefined {
  const space = text.trimEnd().lastIndexOf(' ')
  return space > 0 ? space : undefined
}
