# Ears

How to get T.O.E.Z. hearing, and what to expect once it does.

Everything here is on this machine. No audio leaves it, at any point (ADR-0003).

## Once

```sh
brew install ffmpeg whisper-cpp
./scripts/fetch-ears-models.sh
```

That fetches Whisper large-v3-turbo and the Silero voice activity model — about
575MB, already in ggml format, nothing to build — into `~/.toez/models`. Models
live in the Workspace rather than in this repo because they are T.O.E.Z.'s, not
the code's: reinstalling the app should not mean downloading them again.

## Two permissions macOS will not give you quietly

**Microphone.** Asked for the first time something records, granted with a
dialog. If it was refused, `pnpm listen` says the microphone never opened.

**Accessibility**, for the whole point of push-to-talk: hearing Right ⌘ while
the Owner is working in some other app. System Settings › Privacy & Security ›
Accessibility, and tick whatever is running T.O.E.Z. — under `pnpm listen` that
is the terminal, not Node.

There is no error when this one is missing. The key is simply never heard.

## Listening

```sh
pnpm listen
```

Hold Right ⌘, speak Thai or English or both, release. T.O.E.Z. shows what it
heard, and nothing answers: the Engine and the Voice are stand-ins here, because
the only question this surface asks is whether it heard the Owner right.

Two knobs, for finding out what the Owner's own voice prefers:

| Variable        | Default             | For                                        |
| --------------- | ------------------- | ------------------------------------------ |
| `TOEZ_MODEL`    | large-v3-turbo      | Comparing another ggml model                |
| `TOEZ_LANGUAGE` | `auto`              | Pinning to `th` or `en` instead of guessing |

`auto` lets Whisper decide per utterance, which is the honest default for an
Owner who mixes languages. Each line reports what it decided, so a run of
`pnpm listen` is evidence rather than a feeling.

## Which model

Not settled, and the Owner is the one who settles it. **ADR-0004 is the
measurement**: Thai fine-tunes are exact on Thai and produce fluent nonsense on
English, so the default is plain multilingual Whisper instead of the Thonburian
model ADR-0003 named.

What that leaves open is whether Thonburian's better Thai is worth its total
loss of English. To hear the difference:

```sh
./scripts/build-thonburian-model.sh            # ~30 min, wants PyTorch
TOEZ_MODEL=~/.toez/models/ggml-whisper-th-medium-combined-q5_0.bin pnpm listen
```

Speak the same handful of sentences to each — some Thai, some English, some with
an English word in the middle of a Thai sentence — and keep whichever is right
more often. They can sit side by side in `~/.toez/models`; nothing has to be
deleted to try the other.

## What to expect

**The microphone takes about half a second to open.** avfoundation, not
T.O.E.Z. Words spoken before it opens are not recorded at all, so `pnpm listen`
waits for the device and *then* prints `🎙 ฟังอยู่ครับ` — that, not the
keypress, is the cue to speak. Anything that shows the Owner they are being
heard has to wait for the same moment.

**Two to three seconds to transcribe** a sentence, on an M1 Pro. Whisper reads
the whole recording once the key is released; nothing is transcribed while the
Owner is still talking.

**A tap costs nothing.** Right ⌘ is a key the Owner presses for other reasons.
Voice activity detection finds no speech, the utterance comes back empty, and
the Session goes straight back to idle without waking the Engine. Without that
detection Whisper would invent a word — asked to transcribe silence, it answers
"you".

**The Owner's voice is the only test that counts.**
`pnpm test:integration` puts macOS's own voices through the real whisper.cpp,
which holds the wiring honest. Synthetic speech is far easier to hear than a
person, and it says nothing about how a Thai speaker's English lands.
