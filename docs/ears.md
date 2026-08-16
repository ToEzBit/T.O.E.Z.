# Ears

How to get T.O.E.Z. hearing, and what to expect once it does.

Everything here is on this machine. No audio leaves it, at any point (ADR-0003).

## Once

```sh
brew install ffmpeg whisper-cpp
./scripts/build-thonburian-model.sh
```

The script converts Thonburian Whisper — a Thai fine-tune of Whisper — into the
ggml format whisper.cpp reads, quantizes it, and puts it in `~/.toez/models`
alongside the Silero voice activity model. It wants PyTorch and about 6GB of
scratch space for the conversion, and throws both away afterwards. Expect it to
take a while. Run it again any time; it skips what is already built.

Models live in the Workspace rather than in this repo because they are
T.O.E.Z.'s, not the code's: reinstalling the app should not mean downloading
them again.

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
heard and repeats it back — the Engine is a stand-in here, because the only
question this surface answers is whether the transcript is right.

Two knobs, for finding out what the Owner's own voice prefers:

| Variable        | Default             | For                                        |
| --------------- | ------------------- | ------------------------------------------ |
| `TOEZ_MODEL`    | the Thonburian one  | Trying another ggml model                  |
| `TOEZ_LANGUAGE` | `auto`              | Pinning to `th` or `en` instead of guessing |

`auto` lets Whisper decide per utterance, which is the honest default for an
Owner who mixes languages. Each line reports what it decided, so a run of
`pnpm listen` is evidence rather than a feeling. If Thai-with-English-in-it
keeps coming back as English, `TOEZ_LANGUAGE=th` is the answer.

## What to expect

**The microphone takes about half a second to open.** avfoundation, not
T.O.E.Z. Words spoken before it opens are not recorded at all, so `pnpm listen`
waits for the device and *then* prints `🎙 ฟังอยู่ครับ` — that, not the
keypress, is the cue to speak. Anything that shows the Owner they are being
heard has to wait for the same moment.

**A tap costs nothing.** Right ⌘ is a key the Owner presses for other reasons.
Voice activity detection finds no speech, the utterance comes back empty, and
the Session goes straight back to idle without waking the Engine. Without that
detection Whisper would invent a word — asked to transcribe silence, it answers
"you".

**Thai is harder than English.** That is the risk this whole setup exists to
retire, and the only test that counts is the Owner's own voice on
`pnpm listen`. `pnpm test:integration` checks the wiring against macOS's own
voices, which is a much easier thing to hear.
