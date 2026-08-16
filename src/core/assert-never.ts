/**
 * Exhaustiveness guard for the event and effect unions. Unreachable unless a
 * variant was added without being handled, which the compiler catches first.
 */
export function assertNever(value: never, what: string): never {
  throw new Error(`Unhandled ${what}: ${JSON.stringify(value)}`)
}
