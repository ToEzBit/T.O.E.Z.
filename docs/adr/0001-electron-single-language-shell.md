# Electron single-language shell instead of a native Swift app

T.O.E.Z. is a one-person project; the Owner wants to maintain exactly one language (TypeScript), and the agent brain must be the Claude Agent SDK (TS) regardless of shell. We chose Electron for the whole app — shell, Panel UI, audio pipeline, and Agent SDK all in one TS codebase — over a SwiftUI shell with a Node sidecar.

The known cost: Apple's SpeechTranscriber (free, on-device, fast Thai STT in macOS 26) is a Swift-only API and is unreachable from Electron. This was accepted deliberately because whisper.cpp with Thonburian Whisper (see ADR-0003) is *more* accurate for Thai anyway; the trade is RAM/latency and model management, not accuracy. Don't "fix" this later by bolting on a Swift helper without rereading this trade-off.
