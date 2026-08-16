# Voice stack: local Whisper STT, MiniMax TTS behind a provider interface

Ears are local and free: whisper.cpp (Metal) running Thonburian Whisper — a Thai-fine-tuned Whisper (WER ~6.6% Thai, MIT) — starting with a distilled/quantized model to fit alongside Electron in 16GB RAM. Mouth is cloud: MiniMax speech-2.6/2.8-turbo over streaming WebSocket (<250ms), because the Owner's requirements — natural Thai, selectable/clonable voices ($1.50 one-time clone), one voice speaking mixed Thai-English — have no local answer. Apple's Kanya is the offline-only fallback voice.

**TTS must sit behind a provider interface** — the Owner explicitly required that MiniMax be swappable without rework. No MiniMax types outside the provider module.

Rejected, for the record (so these don't get re-proposed blind):

- **Apple TTS as primary** — exactly one Thai voice (Kanya), dated quality, Siri voices blocked for third-party apps; "selectable voices" is impossible with it.
- **F5-TTS-THAI (local neural)** — best open Thai quality and clonable, but ~real-time-or-slower on Apple Silicon: seconds of delay before speech, unusable for conversation.
- **ElevenLabs** — Thai lives only in the v3 model, which is not their low-latency tier.
- **Azure Speech** — cheaper ($16/1M + free tier vs MiniMax $60/1M) and has a first-party SDK, but stiffer Thai voices, accented English-in-Thai, and voice cloning is enterprise-gated. It is the natural second provider if MiniMax pricing or quality turns.
