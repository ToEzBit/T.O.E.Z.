# Voice

How to get T.O.E.Z. talking, and what to expect once it does.

Unlike the ears, this leaves the machine. The reply — the words T.O.E.Z. is
about to say, and nothing else — goes to MiniMax to be synthesised, because
natural Thai in a selectable voice has no local answer worth having
(**ADR-0003** rejected the ones there are, and says why). No audio of the Owner
ever goes anywhere: that is the ears, and they are entirely on this machine.

## Once

```sh
brew install ffmpeg          # the same one the ears need; ffplay comes with it
```

Then a MiniMax key, from <https://platform.minimax.io>, in a file called `.env`
at the root of this repo:

```sh
MINIMAX_API_KEY=...
```

`.env` is git-ignored and must stay that way — `credentials.test.ts` fails the
build if a key ever reaches a file git would carry. Nothing reads the key but
the process the Owner started: `pnpm say` is handed the file by Node itself,
and the provider takes the key as an argument rather than reaching for it.

## Speaking

```sh
pnpm say
pnpm say "ลองพูดประโยคนี้หน่อยครับ"
```

A reply is written out at the speed the real Engine writes one, and T.O.E.Z.
says it aloud. Nothing asks the Engine anything, so no subscription tokens are
spent; MiniMax characters are, which is why this is a thing the Owner runs and
not a test that runs itself.

| Variable            | Default               | For                                    |
| ------------------- | --------------------- | -------------------------------------- |
| `MINIMAX_API_KEY`   | none — required       | The key, from `.env`                   |
| `TOEZ_VOICE`        | `Thai_male_1_sample8` | Hearing one of the other voices        |
| `TOEZ_VOICE_MODEL`  | `speech-2.6-turbo`    | Trying `speech-2.8-turbo`, or an HD one |

## Which voice

MiniMax has four Thai ones. The default is the first, chosen by the Owner
before any of them had been heard; picking one properly, in Settings, is T11.

| `TOEZ_VOICE`          | MiniMax calls it |
| --------------------- | ---------------- |
| `Thai_male_1_sample8` | Serene Man       |
| `Thai_male_2_sample2` | Friendly Man     |
| `Thai_female_1_sample1` | Confident Woman |
| `Thai_female_2_sample2` | Energetic Woman |

The Persona says "ครับ", so a female voice wants `persona.md` edited to say
"ค่ะ" before it sounds like anyone.

One voice speaks both languages, which is the requirement MiniMax was chosen
for: "เดี๋ยวผมไปแก้ bug ในโปรเจคให้นะครับ" is one sentence in one voice, not a
handover between two. Nothing is told which language it is reading — naming one
would be choosing against the other.

## Why it starts talking before it has finished thinking

The reply is spoken in pieces as it is written, rather than once it is whole.
That is the difference between waiting for transcription plus the whole reply
plus synthesis, and waiting for the first phrase of it.

Where the pieces break is `src/core/session/phrases.ts`, and the hard part is
not English:

- **English** ends a sentence with a full stop, and a full stop with whitespace
  after it is a break. Not one with a digit after it, or "2.5 seconds" would be
  said in two halves.
- **Thai has no sentence-final punctuation at all.** It puts a *space* where
  another language puts a full stop. So a splitter that looks for full stops
  finds nothing in a Thai reply, speaks it in one piece at the end, and passes
  every English test while failing the language T.O.E.Z. is normally spoken to.
  Past eighty characters with no full stop in sight, the break goes at the last
  space instead.

Eighty is the one number here worth tuning by ear. Larger sounds better and
starts later — each piece is synthesised on its own, so every break is a place
the voice can put a small pause it did not mean. Smaller starts sooner.

## What to expect

**The number that matters is the first one.** `pnpm say` prints, for every
phrase, how long MiniMax took to send back the first audio of it (`รอ`) and how
much speech it turned into (`เสียง`), and at the end how long it was before the
first word was said at all. Everything after the first phrase is time the Owner
is already listening through; only the first is silence they are waiting in.

MiniMax promises the first audio inside a quarter of a second. Add a round trip
to Singapore, and the connection being opened on the first phrase of a Session.

**The connection is kept between phrases.** Opening one costs that round trip,
and paying it between the sentences of a single reply would be heard as a gap.
MiniMax hangs up on a connection left quiet for two minutes, which between one
turn and the next is entirely normal, so the next phrase quietly opens another.

**A quarter of a second of it is ffplay.** Starting the player and opening the
audio device costs about that, once, on the first phrase of the Session — the
player is then kept for the rest of it rather than restarted per phrase.

**The Owner's ear is the only test that counts.** `pnpm test:integration`
proves MiniMax turns Thai into sound, keeps one voice across a change of
language, and takes a second phrase down a connection it has already used.
None of that says whether the Voice is one worth talking to.
