/**
 * Anthropic's SDKs pick credentials in a fixed order: `ANTHROPIC_API_KEY`,
 * then `ANTHROPIC_AUTH_TOKEN`, then the OAuth login. Either of the first two —
 * exported in a shell for some other project, and inherited without anyone
 * meaning it — would quietly move T.O.E.Z. onto per-token API billing, which
 * ADR-0002 exists to prevent. So the Engine hands the Claude Code subprocess an
 * environment with both removed, leaving OAuth as the only credential there is.
 */
const BILLED_CREDENTIALS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'] as const

/**
 * A copy of `parent` with those two names gone. Everything else is kept: the
 * subprocess still needs `PATH`, `HOME`, and the rest.
 */
export function subscriptionOnlyEnv(
  parent: NodeJS.ProcessEnv = process.env,
): Record<string, string | undefined> {
  const env = { ...parent }
  // Deleted, not set to undefined: what a subprocess makes of an undefined
  // value is one more thing that could go the wrong way.
  for (const name of BILLED_CREDENTIALS) delete env[name]
  return env
}
