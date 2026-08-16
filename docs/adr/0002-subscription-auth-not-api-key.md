# Claude subscription auth through the Agent SDK, not an API key

The Owner refuses per-token API billing; everything runs on their Claude subscription plan. The embedded Agent SDK spawns the Claude Code binary, which inherits the OAuth credentials from the Owner's `claude login` — so no `ANTHROPIC_API_KEY` exists anywhere in this project. This is a deliberate deviation from the official docs, which direct products built on the Agent SDK to API-key auth; it works and is verified in another of the Owner's running projects.

Consequences that must hold:

- **T.O.E.Z. must never be distributed to anyone else.** Anthropic's terms (enforced since March 2026) prohibit routing subscription credentials to third parties. Personal use on the Owner's own machine is the only configuration this project supports.
- Subagent-heavy work drains the subscription's rolling usage window fast (docs cite ~7x token use for agent teams); throttling multi-agent fan-out is a feature, not an optimization.
- If Anthropic tightens SDK auth, the fallback is driving headless Claude Code (`claude -p --output-format stream-json`) as a subprocess — architecturally close, so keep the engine behind its own module boundary.
