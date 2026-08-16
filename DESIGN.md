# T.O.E.Z. — Confirmed Design

Agreed with the Owner, 2026-08-16, after a full grilling session. Vocabulary: see [CONTEXT.md](./CONTEXT.md). Big decisions and their trade-offs: see [docs/adr/](./docs/adr/).

## Identity

- Personal tool for one Owner only. Never distributed (ADR-0002).
- Capabilities: full Claude Code parity — subagents, MCP servers, skills.
- Persona: Jarvis-style — addresses the Owner as "เจ้านาย", polite, sharp, occasional gentle teasing. Defined in an editable `persona.md` in the Workspace. Replies in the language it was spoken to (Thai → Thai, English → English).
- Future door: self-evolving Persona via propose-then-Owner-approves edits to its own file. Not in v1.

## Architecture

- Electron, TypeScript only (ADR-0001).
- Brain: Claude Agent SDK, subscription OAuth from `claude login`, no API key (ADR-0002).
- STT: whisper.cpp + Thonburian Whisper, distilled/quantized first (M1 Pro, 16GB) (ADR-0003).
- TTS: MiniMax speech-2.6/2.8-turbo, streaming WebSocket, behind a mandatory provider interface (ADR-0003). Second provider: Apple system voices via the macOS `say` command — zero-cost, offline, Owner-selectable outright (many English voices; Thai has only Kanya), and doubling as the automatic offline fallback.

## Interaction

- Lives in the menu bar, launched at login, always resident.
- Push-to-talk: **hold Right ⌘, release to send** (walkie-talkie). Key is user-configurable in settings.
- The Panel floats up Spotlight-style; replies are spoken *and* shown; expandable to a full window for code/detail.
- Wake word: phase 2 (openWakeWord can do a Thai phrase via synthetic training data).

## Permissions

- Hybrid: reads/safe actions auto-approved; risky actions (delete, install, anything leaving the machine) asked by voice + on screen.
- YOLO Mode: voice-toggled per Session, no questions asked. Resets when the Session ends.

## Subagents

- On fan-out: T.O.E.Z. announces by voice what it's dispatching and summarizes by voice when done; live progress is the screen's job.
- Subscription usage caution: agent teams burn ~7x tokens — fan-out should be deliberate, not default.

## Workspace & Memory

- Workspace at `~/.toez/` — separate from this repo; survives reinstall; may be its own private git repo for backup. Electron cache stays in `~/Library/Application Support`.
- Contents: `persona.md`, memory (markdown files + index), transcripts, skills, MCP config, registered projects.
- Memory capture: after each Session, T.O.E.Z. extracts salient facts into markdown automatically; every Transcript is kept permanently. Retrieval starts as grep; semantic search layered on only when grep stops scaling.
- MCP/skills config is T.O.E.Z.'s own — nothing auto-inherited from `~/.claude`; share individual servers by pointing at them explicitly.
- Registered Projects: Owner introduces a project once (name + path); afterwards summonable by name in speech.
