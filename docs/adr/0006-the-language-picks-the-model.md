# The language picks the model: Thai listens with Thonburian

Thai is transcribed by **Thonburian `whisper-th-medium-combined`**; everything
else by **`large-v3-turbo`**. `modelPathFor(language)` is the whole rule.

This reverses the choice in [ADR-0004](./0004-multilingual-whisper-over-thai-fine-tune.md)
for Thai, and it reverses it for two reasons: that decision was made on
synthesised speech, and it was made before the language became something the
Owner chooses ([ADR-0005](./0005-language-is-chosen-not-detected.md)).

## The recordings that settled it

Four sentences, spoken by the Owner into AirPods — their actual microphone,
not a good one. Both models were given `-l th`, so neither had to guess.

| Spoken | `large-v3-turbo` | **Thonburian medium** |
| --- | --- | --- |
| สวัสดีครับ ผมชื่อเพชร | สวัสดีครับ ผมชื่อเพ**ช** | **exact** |
| ตอนนี้หิวข้าวจังเลย | exact | **exact** |
| ช่วยเปิด terminal ให้หน่อยครับ | **ก็ให้**เปิด**เธอมินาเอา**ให้หน่อยครับ | ช่วยเปิด**เทอร์มินัล**ให้หน่อยครับ |
| ขอสรุปสั้น ๆ หน่อยสิ | **พอสะรูป**สั้นสั้นหน่อยสิ | **exact** |

Three of four exact against one of four. The third row is the interesting one:
both models transliterate "terminal", but Thonburian writes `เทอร์มินัล`, which
is the word a Thai reader would use, while `large-v3-turbo` writes `เธอมินาเอา`,
which is not a word. It also loses `ช่วย` — the difference between asking for
help and issuing an instruction.

`distill-whisper-th-medium` was measured too: two of four, dropping `ส` from
`สวัสดี`. It is twice as fast and not worth it.

## Why ADR-0004 got this wrong

Its measurements were of macOS's own voices, which are cleaner than any person
speaking into any microphone. On that audio every model was exact on Thai, so
Thai could not discriminate between them and English decided everything — and
only `large-v3-turbo` could hear English.

Real speech through a Bluetooth headset discriminates immediately. The Owner's
`ส` and `ห` are fricatives that live between 4 and 8 kHz, which is the band a
headset microphone throws away; `large-v3-turbo` guesses at what is left and
Thonburian, trained on a great deal of Thai, does not have to.

ADR-0004's finding stands unchanged: Thonburian cannot hear English. That is why
there are two models rather than one, instead of Thonburian everywhere.

## Rejected, so these are not tried again

- **An initial prompt naming the English terms.** It fixes `terminal` for
  `large-v3-turbo`, and does nothing for Thonburian's transliteration while
  making `ขอสรุป` worse — the prompt costs context the sentence needed.
- **Compensating the lost treble** — `highshelf f=3000 g=8` plus
  `dynaudnorm` before transcription. Byte-for-byte identical output. Thonburian
  is already robust to the narrow band, and nothing in the audio pipeline has to
  change.
- **Asking the Owner to use the built-in microphone.** See ADR-0005: AirPods are
  the microphone they use, so a setup that needs a different one does not work.

## The cost

Two models on disk, about 1.1GB, and `scripts/build-thonburian-model.sh` is now
required rather than optional — there is no ready-made ggml Thonburian to
download, so Thai costs a one-time conversion with PyTorch. `pnpm listen` says
so by name when the Thai model is missing.

English inside Thai speech arrives transliterated. Whether `เทอร์มินัล` is
enough for the Engine to act on is not yet known; it is a readable Thai word,
which is the most that can be said so far.
