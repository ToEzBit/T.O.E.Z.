/**
 * A queue of canned values a fake hands out one turn at a time, and complains
 * loudly about running dry — a fake that silently returns nothing makes for a
 * baffling test failure.
 */
export class Script<T> {
  readonly #what: string
  readonly #entries: readonly T[]
  #turn = 0

  constructor(what: string, entries: readonly T[]) {
    this.#what = what
    this.#entries = entries
  }

  next(): T {
    const entry = this.#entries[this.#turn]
    if (entry === undefined) {
      throw new Error(
        `Ran out of ${this.#what}: asked for turn ${String(this.#turn + 1)}, ` +
          `only ${String(this.#entries.length)} scripted.`,
      )
    }
    this.#turn += 1
    return entry
  }
}
