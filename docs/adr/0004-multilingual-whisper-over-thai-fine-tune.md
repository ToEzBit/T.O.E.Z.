# Multilingual Whisper as the ears, not a Thai fine-tune

ADR-0003 chose Thonburian Whisper because it is the most accurate Thai model
available. Built and measured, both variants turn out to have forgotten English
completely — so the ears are plain Whisper **large-v3-turbo, quantized to
`q5_0`**, and Thonburian is kept as a comparison the Owner can switch to with
`TOEZ_MODEL`.

**This narrows ADR-0003 rather than reversing it.** Local, free, on-device
whisper.cpp with Metal is unchanged, and so is the reasoning about RAM and
latency on a 16GB M1 Pro. What that reasoning did not anticipate is that
fine-tuning on Thai costs the multilingual ability the Owner's own speech needs:
they mix Thai and English inside a single sentence, which was a requirement of
the design from the start.

## What was measured

Four models against four recordings made with macOS's own voices — Kanya for
Thai, Samantha for English — plus two seconds of digital silence. Every run used
`-l auto` and Silero VAD, on an M1 Pro.

| | Thai | Thai, harder | English | Mixed | Silence | Size | Per utterance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `distill-whisper-th-medium` | exact | exact | **Thai gibberish** | **transliterated** | nothing | 307MB | 1.6–1.9s |
| `whisper-th-medium-combined` | exact | exact | **Thai gibberish** | **transliterated** | nothing | 539MB | 2.4–4.3s |
| `medium` | exact | **two errors** | exact | best of the four | nothing | 539MB | 1.9–2.5s |
| **`large-v3-turbo`** | exact | exact | exact | partial | nothing | 574MB | 2.5–3.3s |

"Thai gibberish" is not an exaggeration. Given Samantha saying _"Good evening.
What is the weather like today?"_, `distill-whisper-th-medium` answers
`สวัสดีครับ สิทธิพันธ์` and `whisper-th-medium-combined` answers `สวัสดีค่ะ
วันนี้กฎหมายเป็นยังไงบ้าง` — fluent Thai sentences with no relationship to what
was said. Both report the language as Thai. Forcing `-l en` makes it worse, not
better: `ดี ที่ดี ที่ดี ที่ดีดีดดีดดีด`.

Given _"ช่วยเปิด terminal แล้วรัน pnpm test ให้หน่อยครับ"_, the Thai fine-tunes
render the English into Thai script — `รันพี่เอ็นพี่เอ็มเทสต์` for "run pnpm
test". `large-v3-turbo` keeps `PNPM Test` in Latin script, and `medium` keeps
`Terminal และ Run PNPM Test`. The difference matters because `เทอร์เนิล` reaching
the Engine is a wrong utterance, not an accented one, and "ไปแก้ bug ในโปรเจค X"
is how the Owner actually talks.

## How the winner was picked

`medium` won the mixed recording outright, and it is not the choice. The rule
applied was **Thai first, then English**: Thai is the language T.O.E.Z. is
spoken to in, and a model that mishears it is wrong about the sentence rather
than about one borrowed word. `medium` lost the harder Thai recording,
mishearing `ฉบับนี้` as `ชะบักนี้` and `ค่าชดเชย` as `ค่าชดเฉย`. That left two
models exact on both Thai recordings — `large-v3-turbo` and Thonburian — and
only one of those two can hear English at all.

So the order is: exact on Thai, then English at all, then mixed as a
tie-breaker that never had to be applied. `large-v3-turbo` is the only model
that reaches the second rung.

## What this evidence cannot settle

The recordings are synthesised, and synthetic speech is much easier to hear than
a person. Three limits worth knowing before anyone reopens this:

- **Thai quality between `large-v3-turbo` and Thonburian is untested.** Both
  were exact on both Thai recordings; published word error rates favour
  Thonburian by several points on real speech. If Thai accuracy on the Owner's
  voice turns out to matter more than English, that is a real trade, not a
  mistake.
- **The mixed recording is weak evidence.** Kanya is a Thai voice reading Latin
  text, so "terminal" comes out with Thai phonology; `large-v3-turbo` heard it
  as `เธอร์มือเนื้อ` and also misheard `เปิด` as `ปิด`. A person code-switching
  sounds different.
- **English was never the risk.** It is here because it is the requirement the
  Thai fine-tunes fail, not because it was ever in doubt.

`pnpm listen` prints the detected language on every turn and takes `TOEZ_MODEL`,
so the Owner can settle all three on their own voice. Both Thonburian variants
are still buildable — `scripts/build-thonburian-model.sh` — precisely so that
comparison stays cheap.
