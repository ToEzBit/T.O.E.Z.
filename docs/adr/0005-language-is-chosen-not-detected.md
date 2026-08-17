# The Owner chooses the language; Whisper does not guess it

Transcription runs with a language the Owner has picked — Thai by default —
rather than with Whisper's `auto` detection. The microphone stays whatever macOS
calls default, whatever that happens to be.

## What happened

The Owner said "สวัสดีครับ" three times into `pnpm listen`, with `auto`. It came
back as:

| | Language reported | Transcript |
| --- | --- | --- |
| 1 | `ko` | `하루, 사와디, 콜압.` |
| 2 | `en` | *(nothing)* |
| 3 | `en` | `the club.` |

The first line is the informative one. `사와디` is *sawadi* — the sounds arrived
intact, in the wrong alphabet. Whisper was not mishearing the Owner; it was
placing what it heard in the wrong language and then spelling it faithfully.

Detection is the part that failed, and it is structurally fragile: Whisper picks
one language for a whole recording, from the first thirty seconds. A two-second
utterance gives it almost nothing to go on.

## Why not just use a better microphone

The default input was AirPods, which as a microphone drop to call quality —
24 kHz over Bluetooth, against 48 from the built-in one. Narrow audio is
certainly part of why detection failed.

Selecting the microphone was built, and then removed. **The Owner uses AirPods
as their main microphone**, so a setup that works only through the built-in one
is a setup that does not work. Asking them to change headphones to be understood
is the wrong end of the problem, and a microphone setting would have made that
workaround look like a solution.

So the microphone is simply whatever macOS calls default. The Owner picks it
where they already pick it, in Sound settings, and T.O.E.Z. follows.

## What choosing costs

Thai is the language the Owner speaks to T.O.E.Z. in, so it is the default.
Whisper decoding Thai renders English words inside a Thai sentence in Latin
script, so "ไปแก้ bug ในโปรเจค X" still works — mixed speech was never what
detection was for.

What is given up is speaking *only* English without saying so first. Under
`-l th` an English sentence comes back transliterated into Thai. The Owner
accepted that trade directly: choosing beforehand is fine, being guessed at
wrongly is not.

`TOEZ_LANGUAGE` switches it for a session — `en`, or `auto` to have Whisper
guess again. A real setting, on a surface the Owner can reach without a
terminal, is T11's.

`WhisperOptions.language` has no default. Detection has to be asked for by name,
so that nobody arrives back at `auto` by not thinking about it.
