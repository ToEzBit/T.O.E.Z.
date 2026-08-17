# Ears

How to get T.O.E.Z. hearing, and what to expect once it does.

Everything here is on this machine. No audio leaves it, at any point (ADR-0003).

## Once

```sh
brew install ffmpeg whisper-cpp
./scripts/fetch-ears-models.sh        # large-v3-turbo + voice detection, ~575MB
./scripts/build-thonburian-model.sh   # Thai, ~30 min, wants PyTorch
```

Both, because Thai and everything else are heard by different models —
**ADR-0006**. The first is a download; the second is a conversion, because no
ready-made ggml Thonburian exists to fetch. Skip it only if you never speak Thai
to T.O.E.Z.

Models live in `~/.toez/models` — the Workspace rather than this repo, because
they are T.O.E.Z.'s and reinstalling the app should not mean getting them
again.

## Two permissions macOS will not give you quietly

**Microphone.** Asked for the first time something records, granted with a
dialog. If it was refused, `pnpm listen` says the microphone never opened.

**Accessibility**, for the whole point of push-to-talk: hearing Right ⌘ while
the Owner is working in some other app. There is no error when this one is
missing — the key is simply never heard.

macOS grants both to the *application*, and under `pnpm listen` that is
Electron, not the terminal. So drag this into System Settings › Privacy &
Security › Accessibility and tick it:

```
node_modules/.pnpm/electron@<version>/node_modules/electron/dist/Electron.app
```

`open node_modules/.pnpm/electron@*/node_modules/electron/dist/` puts it in a
Finder window to drag from. Ticking the terminal does nothing, because the
terminal is not the process listening.

## Why Electron runs the ears

`pnpm ask` runs on Node; `pnpm listen` runs on Electron, and not for anything
Electron provides. The keyboard hook is a native module whose event tap
delivers exactly one event on Node 26 and then goes deaf — key-down arrives,
key-up never does, and a held key is never let go. On Electron's own Node 24 it
runs indefinitely. Measured both ways with synthesised keystrokes before
changing anything.

Electron strips the TypeScript itself, so there is still no bundler in the way,
and this is the runtime the app ships on anyway.

## Listening

```sh
pnpm listen
```

Hold Right ⌘, speak Thai or English or both, release. T.O.E.Z. shows what it
heard, and nothing answers: the Engine and the Voice are stand-ins here, because
the only question this surface asks is whether it heard the Owner right.

It listens in **Thai** unless told otherwise, it does not try to work the
language out for itself, and the language decides which model hears it.

| Variable          | Default              | For                                             |
| ----------------- | -------------------- | ----------------------------------------------- |
| `TOEZ_LANGUAGE`   | `th`                 | An English session (`en`), or guessing (`auto`) |
| `TOEZ_MODEL`      | whichever fits above | Forcing one model regardless of language        |
| `TOEZ_KEY`        | `MetaRight`          | Holding a different key                         |
| `TOEZ_KEEP_AUDIO` | off — nothing kept   | Keeping recordings in a directory, to listen to |

The microphone is whatever macOS calls default, always. Pick it in Sound
settings; T.O.E.Z. follows.

`TOEZ_KEEP_AUDIO=/tmp/toez-audio` is how a wrong transcript gets settled: a bad
microphone and a misheard word are identical on screen and obvious in the ear.
Recordings are deleted the moment they are transcribed unless this is set.

## Why the language is chosen and not detected

Ask Whisper to guess, and it guesses once for the whole recording from the first
thirty seconds — which on two seconds through a Bluetooth headset is almost
nothing to go on. "สวัสดีครับ" came back as `하루, 사와디, 콜압`, reported as
Korean. `사와디` is *sawadi*: the sounds were heard correctly and written in the
wrong alphabet.

So Thai is the default and **ADR-0005** has the reasoning. Thai decoding keeps
English words inside a Thai sentence in Latin script, so "ไปแก้ bug ในโปรเจค X"
is unaffected; what needs saying beforehand is a session of English only, with
`TOEZ_LANGUAGE=en`.

Each line still reports the language, so a run is evidence rather than a
feeling. With a language chosen it just confirms what was asked for; under
`auto` it is the whole story.

## Which model

Settled on the Owner's own voice, through the headset they actually use —
**ADR-0006** has the four recordings.

| Language | Model | Why |
| --- | --- | --- |
| `th` | Thonburian `whisper-th-medium-combined` | Three of four sentences exact, against one of four |
| anything else | `large-v3-turbo` | Thonburian cannot hear English at all |

English words inside Thai speech come back transliterated — `เทอร์มินัล` for
"terminal". That is the price, and it is a readable Thai word; the multilingual
model given the same sentence produced `เธอมินาเอา`, which is not.

`TOEZ_MODEL` forces one regardless, which is how the next comparison gets made:

```sh
TOEZ_MODEL=~/.toez/models/ggml-large-v3-turbo-q5_0.bin pnpm listen
```

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
