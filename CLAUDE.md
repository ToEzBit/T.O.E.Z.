# T.O.E.Z.

Personal Jarvis-style voice agent for macOS. Start with [DESIGN.md](./DESIGN.md) for the confirmed design, [CONTEXT.md](./CONTEXT.md) for vocabulary, and [docs/adr/](./docs/adr/) for the decisions behind it.

## Commands

Package manager is **pnpm**. Electron and esbuild need their install scripts, which pnpm gates — `pnpm.onlyBuiltDependencies` in `package.json` lists them.

| Command                | Does                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `pnpm dev`             | Runs the app with reload                                          |
| `pnpm build`           | Bundles the main process into `out/`                              |
| `pnpm start`           | Runs the built bundle                                             |
| `pnpm test`            | The fast suite — Session orchestrator behaviour, fakes only       |
| `pnpm test:integration`| Provider contract tests; need network or local models             |
| `pnpm typecheck`       | `tsc --noEmit` over `src` and `test`                              |
| `pnpm lint`            | ESLint, type-aware                                                |

TypeScript is pinned to 5.9 because typescript-eslint caps at `<6.1.0`.

## Layout

- `src/core/` — no Electron imports, ever. The Session orchestrator and the port interfaces live here, so they run under plain Node in tests.
  - `ports/` — the three ADR-mandated interfaces: Engine, Transcriber, Voice provider.
  - `session/` — `orchestrator.ts` is pure (`state + event → state + effects`); `session-runtime.ts` runs those effects against the ports and feeds results back as events.
  - `testing/` — one fake per port, used by the tests.
- `src/main/` — the Electron main process: menu bar presence and, later, the Panel.
- `resources/` — menu bar icons. macOS template images: black plus alpha only, `@2x` alongside.

## Testing

One seam: the Session orchestrator. Tests feed it events and assert the effects that come out — never internal state, never provider internals. New behaviour means a new event or effect variant, not a new mock. See `test/session-orchestrator.test.ts` for the pattern.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on ToEzBit/T.O.E.Z. via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
