# T.O.E.Z.

Personal Jarvis-style voice agent for macOS. Start with [DESIGN.md](./DESIGN.md) for the confirmed design, [CONTEXT.md](./CONTEXT.md) for vocabulary, and [docs/adr/](./docs/adr/) for the decisions behind it.

## Commands

Package manager is **pnpm**. esbuild needs its install script, which pnpm gates — `pnpm.onlyBuiltDependencies` in `package.json` lists it. `uiohook-napi` is listed under `pnpm.ignoredBuiltDependencies` instead: it ships a `darwin-arm64` prebuild that loads without its build script ever running, so gating it costs nothing and compiling it would need toolchain nobody has asked for. Electron needs no entry: since v43 it has no postinstall and fetches its binary the first time you run it, so a fresh clone's first `pnpm dev` prints `Downloading Electron binary...` and then starts.

Three things are not npm's to install: `ffmpeg` and `whisper-cpp`, from Homebrew, and the Whisper models fetched by `scripts/fetch-ears-models.sh`. Only the ears need them. See [docs/ears.md](./docs/ears.md).

| Command                | Does                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `pnpm ask`             | One real Session from the keyboard — see below                    |
| `pnpm listen`          | The ears on their own: hold Right ⌘ and read the Utterance        |
| `pnpm dev`             | Runs the app with reload                                          |
| `pnpm build`           | Bundles the main process into `out/`                              |
| `pnpm start`           | Runs the built bundle                                             |
| `pnpm test`            | The fast suite — Session orchestrator behaviour, fakes only       |
| `pnpm test:integration`| Provider contract tests; need network or local models             |
| `pnpm typecheck`       | `tsc --noEmit` over `src` and `test`                              |
| `pnpm lint`            | ESLint, type-aware                                                |

TypeScript is pinned to 5.9 because typescript-eslint caps at `<6.1.0`.

`pnpm ask` and `pnpm listen` run `src/dev/` straight through Node, which strips
the types itself — no bundler in the way, so the Engine and the ears can be
exercised without starting Electron. The `--disable-warning` flag on them only
silences Node's note that this package has no `"type": "module"`; adding one
would change how `out/main` is loaded, which is Electron's business.

`pnpm ask` talks to the real Engine on the Owner's subscription, so it spends
real tokens. So does `pnpm test:integration`, which needs `claude login` to have
happened. `pnpm listen` never does — its Engine and its Voice are
stand-ins with nothing to say. `pnpm test` never does either.

## Layout

- `src/core/` — no Electron imports, ever. The Session orchestrator and the port interfaces live here, so they run under plain Node in tests.
  - `ports/` — the three interfaces the spec fixes as fakeable seams: Engine, Transcriber, Voice provider. ADR-0002 requires the Engine keep its own boundary; ADR-0003 makes the Voice provider interface mandatory.
  - `session/` — `orchestrator.ts` is pure (`state + event → state + effects`); `session-runtime.ts` runs those effects against the ports and feeds results back as events.
  - `workspace/` — `~/.toez`: the Persona now, Memory and Transcripts later. Opening it creates it, so first run needs no setup.
  - `testing/` — one fake per port, used by the tests.
- `src/providers/` — the real things behind the ports. Node, not Electron, so they run under `pnpm ask`, `pnpm listen` and the integration tests.
  - `engine/` — the Agent SDK Engine, which ADR-0002 requires stay behind its own boundary.
  - `transcriber/` — the ears: ffmpeg records, whisper.cpp reads. Both are subprocesses, so nothing here has to be rebuilt against Electron's ABI.
  - `hotkey/` — Right ⌘, watched system-wide. Not a port and not behind one: ports are what the Session *calls*, and this only tells it something happened, which is what a SessionEvent is for. The three fakeable seams stay three.
- `src/dev/` — the keyboard-driven Session, the ears on their own, and the stand-ins they need. Not shipped; deleted once there are real ears and a real mouth in the app itself.
- `src/main/` — the Electron main process: menu bar presence and, later, the Panel.
- `resources/` — menu bar icons. macOS template images: black plus alpha only, `@2x` alongside.
- `scripts/` — one-off setup a person runs by hand. `fetch-ears-models.sh` gets the models the ears run on; `build-thonburian-model.sh` builds the Thai fine-tune the Owner is comparing them against (ADR-0004).

## Testing

One seam: the Session orchestrator. Tests feed it events and assert the effects that come out — never internal state, never provider internals. New behaviour means a new event or effect variant, not a new mock. See `test/session-orchestrator.test.ts` for the pattern.

Three other files are in the fast suite, and none of them mocks anything: `workspace.test.ts` drives the real Workspace against a temp directory, and `subscription-auth.test.ts` checks a promise ADR-0002 makes about the whole repository rather than about any one module. What a provider actually does belongs in `*.integration.test.ts`, against the real provider — a fake Engine can only prove what it was told to say, and a fake Transcriber can only prove what it was told it heard.

Some things no test can settle. Whether Whisper hears the *Owner* correctly is answered by the Owner on `pnpm listen`; `ears.integration.test.ts` puts macOS's own voices through the real whisper.cpp, which holds the wiring honest and is a much easier thing to hear. Which model to run is still open for the same reason — ADR-0004.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on ToEzBit/T.O.E.Z. via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
