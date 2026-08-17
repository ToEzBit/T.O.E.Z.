#!/usr/bin/env bash
#
# Fetches the two models T.O.E.Z. listens with, ready-made:
#
#   - Whisper large-v3-turbo, quantized. What every language except Thai listens
#     with; Thai has its own model (ADR-0006).
#   - Silero voice activity detection, without which Whisper invents words out
#     of silence.
#
# Nothing to build and no Python: these are already in ggml format. About 575MB.
# They land in ~/.toez/models, which is the Workspace, so they survive
# reinstalling the app.
#
# Thai needs scripts/build-thonburian-model.sh as well — that one is a
# conversion rather than a download, because no ready-made ggml of it exists.

set -euo pipefail

MODELS_DIR="$HOME/.toez/models"
BASE_URL='https://huggingface.co'

fetch() {
  local name="$1" url="$2" target="$MODELS_DIR/$1"

  printf '\n▸ %s\n' "$name"
  if [ -f "$target" ]; then
    echo '  already here'
    return
  fi

  # Resumable, and checked afterwards: a truncated model does not complain, it
  # aborts whisper-cli with a signal several turns later.
  curl -fL --retry 3 -C - --progress-bar -o "$target" "$url"

  local want got
  want="$(curl -fsIL "$url" | tr -d '\r' | awk 'tolower($1) == "content-length:" { n = $2 } END { print n }')"
  got="$(wc -c <"$target" | tr -d ' ')"
  if [ "$want" != "$got" ]; then
    rm -f "$target"
    printf 'Downloaded %s bytes of an expected %s — run this again.\n' "$got" "$want" >&2
    exit 1
  fi
}

command -v curl >/dev/null 2>&1 || {
  echo 'Missing curl — it ships with macOS.' >&2
  exit 1
}

mkdir -p "$MODELS_DIR"

fetch 'ggml-large-v3-turbo-q5_0.bin' \
  "$BASE_URL/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin"
fetch 'ggml-silero-v5.1.2.bin' \
  "$BASE_URL/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin"

printf '\nDone. Thai also needs ./scripts/build-thonburian-model.sh\n\n'
ls -lh "$MODELS_DIR"
