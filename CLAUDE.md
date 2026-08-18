# T.O.E.Z.

Personal Jarvis-style voice agent for macOS. Start with [DESIGN.md](./DESIGN.md) for the confirmed design, [CONTEXT.md](./CONTEXT.md) for vocabulary, and [docs/adr/](./docs/adr/) for the decisions behind it.

## Commands

Package manager is **pnpm**. esbuild needs its install script, which pnpm gates — `pnpm.onlyBuiltDependencies` in `package.json` lists it. `uiohook-napi` is listed under `pnpm.ignoredBuiltDependencies` instead: it ships a `darwin-arm64` prebuild that loads without its build script ever running, so gating it costs nothing and compiling it would need toolchain nobody has asked for. Electron needs no entry: since v43 it has no postinstall and fetches its binary the first time you run it, so a fresh clone's first `pnpm dev` prints `Downloading Electron binary...` and then starts.

Three things are not npm's to install: `ffmpeg` and `whisper-cpp`, from Homebrew, and two Whisper models — `scripts/fetch-ears-models.sh` downloads the multilingual one, `scripts/build-thonburian-model.sh` converts the Thai one. Two, because the language decides which model hears it (ADR-0006). Only the ears need any of this. See [docs/ears.md](./docs/ears.md). The mouth needs one more thing nobody can install for you: a MiniMax API key in `.env`, which is git-ignored and stays that way — see [docs/voice.md](./docs/voice.md).

| Command                | Does                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `pnpm ask`             | One real Session from the keyboard — see below                    |
| `pnpm listen`          | The ears on their own: hold Right ⌘ and read the Utterance        |
| `pnpm say`             | The mouth on its own: a written reply spoken aloud                |
| `pnpm dev`             | Runs the app with reload                                          |
| `pnpm build`           | Bundles the main process into `out/`                              |
| `pnpm start`           | Runs the built bundle                                             |
| `pnpm test`            | The fast suite — Session orchestrator behaviour, fakes only       |
| `pnpm test:integration`| Provider contract tests; need network or local models             |
| `pnpm typecheck`       | `tsc --noEmit` over `src` and `test`                              |
| `pnpm lint`            | ESLint, type-aware                                                |

TypeScript is pinned to 5.9 because typescript-eslint caps at `<6.1.0`.

`pnpm ask` runs `src/dev/ask.ts` straight through Node, which strips the types
itself — no bundler in the way, so the Engine can be exercised without starting
Electron. The `--disable-warning` flag on it only silences Node's note that this
package has no `"type": "module"`; adding one would change how `out/main` is
loaded, which is Electron's business.

`pnpm listen` is the same idea run by Electron instead, and not for anything
Electron provides. `uiohook-napi`'s event tap delivers one event on Node 26 and
then goes deaf — key-down arrives, key-up never does — while on Electron's own
Node 24 it runs indefinitely. Electron strips the types too, so no bundler
enters here either. The consequence to remember is that macOS grants the
microphone and Accessibility to *Electron* under `pnpm listen`, not to the
terminal; docs/ears.md says which file to tick.

`pnpm say` is the same again on plain Node — no hotkey, so no Electron. Node
reads `.env` itself with `--env-file-if-exists`, which is the whole of how the
MiniMax key reaches it.

`pnpm ask` talks to the real Engine on the Owner's subscription, so it spends
real tokens. So does `pnpm test:integration`, which needs `claude login` to have
happened, and which also spends MiniMax characters. `pnpm say` spends those and
no tokens. `pnpm listen` spends nothing — its Engine and its Voice are
stand-ins with nothing to say. `pnpm test` never does either.

## Layout

- `src/core/` — no Electron imports, ever. The Session orchestrator and the port interfaces live here, so they run under plain Node in tests.
  - `ports/` — the three interfaces the spec fixes as fakeable seams: Engine, Transcriber, Voice provider. ADR-0002 requires the Engine keep its own boundary; ADR-0003 makes the Voice provider interface mandatory.
  - `session/` — `orchestrator.ts` is pure (`state + event → state + effects`); `session-runtime.ts` runs those effects against the ports and feeds results back as events. `phrases.ts` decides how much of a streaming reply can be spoken yet — Thai has no full stop, so this is not a sentence splitter.
  - `workspace/` — `~/.toez`: the Persona now, Memory and Transcripts later. Opening it creates it, so first run needs no setup.
  - `testing/` — one fake per port, used by the tests.
- `src/providers/` — the real things behind the ports. Node, not Electron, so they run under `pnpm ask`, `pnpm listen`, `pnpm say` and the integration tests.
  - `engine/` — the Agent SDK Engine, which ADR-0002 requires stay behind its own boundary.
  - `transcriber/` — the ears: ffmpeg records, whisper.cpp reads. Both are subprocesses, so nothing here has to be rebuilt against Electron's ABI.
  - `voice/` — the mouth: MiniMax synthesises over a WebSocket, ffplay plays. ADR-0003 makes the provider interface mandatory, so nothing MiniMax-shaped leaves this directory. The socket is Node's own — no `ws` dependency; custom headers on it were checked under both Node 26 and Electron's Node 24.
  - `hotkey/` — Right ⌘, watched system-wide. Not a port and not behind one: ports are what the Session *calls*, and this only tells it something happened, which is what a SessionEvent is for. The three fakeable seams stay three.
- `src/dev/` — the keyboard-driven Session, the ears on their own, the mouth on its own, and the stand-ins they need. Not shipped; deleted once there are real ears and a real mouth in the app itself.
- `src/main/` — the Electron main process: menu bar presence and, later, the Panel.
- `resources/` — menu bar icons. macOS template images: black plus alpha only, `@2x` alongside.
- `scripts/` — one-off setup a person runs by hand. `fetch-ears-models.sh` downloads the model every language but Thai listens with; `build-thonburian-model.sh` converts the one Thai listens with (ADR-0006).

## Testing

One seam: the Session orchestrator. Tests feed it events and assert the effects that come out — never internal state, never provider internals. New behaviour means a new event or effect variant, not a new mock. See `test/session-orchestrator.test.ts` for the pattern.

Three other files are in the fast suite, and none of them mocks anything: `workspace.test.ts` drives the real Workspace against a temp directory, `subscription-auth.test.ts` checks what the Engine hands its subprocess, and `credentials.test.ts` reads every file git would carry to prove no key is written down in any of them. What a provider actually does belongs in `*.integration.test.ts`, against the real provider — a fake Engine can only prove what it was told to say, and a fake Transcriber can only prove what it was told it heard.

Some things no test can settle. Whether Whisper hears the *Owner* correctly is answered by the Owner on `pnpm listen`; `ears.integration.test.ts` puts macOS's own voices through the real whisper.cpp, which holds the wiring honest and is a much easier thing to hear. Every open question about the ears was settled that way and not by a test: that the language is chosen rather than detected (ADR-0005), and that the chosen language picks the model (ADR-0006, which reversed ADR-0004 once there were recordings of a person rather than of macOS). The mouth is the same shape: `voice.integration.test.ts` proves MiniMax turns Thai into sound and takes a second phrase down one connection, and whether the Voice is one worth talking to is `pnpm say` and the Owner's ear.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on ToEzBit/T.O.E.Z. via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
