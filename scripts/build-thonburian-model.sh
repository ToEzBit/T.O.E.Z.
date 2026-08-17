#!/usr/bin/env bash
#
# Builds a Thai Whisper fine-tune into the ggml format whisper.cpp reads, and
# quantizes it.
#
#   ./scripts/build-thonburian-model.sh [huggingface-model]
#
# This is what Thai listens with (ADR-0006), and it has to be built rather than
# downloaded because no ready-made ggml Thonburian exists. Run it once, unless
# you never speak Thai to T.O.E.Z.
#
# Every other language listens with large-v3-turbo, which
# scripts/fetch-ears-models.sh downloads — no build, no Python. Run that one too.
#
# The built file is named after the model it came from, so several can sit side
# by side in ~/.toez/models for `TOEZ_MODEL` to choose between.
#
# Everything lands in ~/.toez/models, which is the Workspace, so it survives
# reinstalling the app. Takes a while and wants ~10GB of scratch space: the
# conversion needs PyTorch, and the weights are gigabytes before quantizing.
# Both are thrown away at the end.

set -euo pipefail

HF_MODEL="${1:-biodatlab/whisper-th-medium-combined}"
MODEL_NAME="ggml-${HF_MODEL##*/}"
QUANTIZATION='q5_0'

MODELS_DIR="$HOME/.toez/models"
BUILD_DIR="$MODELS_DIR/.build"
BUILT="$MODELS_DIR/$MODEL_NAME-$QUANTIZATION.bin"

# Pinned to the whisper.cpp release Homebrew installs: the ggml file format and
# the converter that writes it have to agree.
WHISPER_CPP_TAG='v1.9.2'
CONVERTER_URL="https://raw.githubusercontent.com/ggml-org/whisper.cpp/${WHISPER_CPP_TAG}/models/convert-h5-to-ggml.py"

# Whisper's mel filterbank, which lives in OpenAI's repo rather than in any
# fine-tune, and which the converter copies into the ggml file.
MEL_FILTERS_URL='https://raw.githubusercontent.com/openai/whisper/main/whisper/assets/mel_filters.npz'

step() { printf '\n▸ %s\n' "$1"; }

need() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Missing %s — %s\n' "$1" "$2" >&2
    exit 1
  }
}

need curl 'it ships with macOS'
need python3 'brew install python'
need whisper-quantize 'brew install whisper-cpp'

mkdir -p "$MODELS_DIR" "$BUILD_DIR"

if [ -f "$BUILT" ]; then
  step "$(basename "$BUILT") is already built — delete it to rebuild."
  exit 0
fi

step 'PyTorch, for the conversion only'
if [ ! -x "$BUILD_DIR/venv/bin/python" ]; then
  python3 -m venv "$BUILD_DIR/venv"
fi
"$BUILD_DIR/venv/bin/pip" install --quiet --upgrade pip
"$BUILD_DIR/venv/bin/pip" install --quiet torch transformers numpy huggingface_hub

step "$HF_MODEL"
"$BUILD_DIR/venv/bin/python" - "$HF_MODEL" "$BUILD_DIR/hf" <<'PY'
import sys
from huggingface_hub import snapshot_download

# Weights and tokenizer only: these repos also carry training logs and images.
snapshot_download(
    sys.argv[1],
    local_dir=sys.argv[2],
    allow_patterns=['*.json', '*.txt', '*.safetensors'],
)
PY

step 'Converter and mel filterbank'
curl -fLs -o "$BUILD_DIR/convert-h5-to-ggml.py" "$CONVERTER_URL"
mkdir -p "$BUILD_DIR/whisper/whisper/assets"
curl -fLs -o "$BUILD_DIR/whisper/whisper/assets/mel_filters.npz" "$MEL_FILTERS_URL"

# The converter reads the byte-level BPE vocabulary from vocab.json. Some of
# these fine-tunes ship it; the rest keep it inside tokenizer.json instead.
if [ ! -f "$BUILD_DIR/hf/vocab.json" ]; then
  step 'Recovering vocab.json from tokenizer.json'
  "$BUILD_DIR/venv/bin/python" - "$BUILD_DIR/hf" <<'PY'
import json
import sys
from pathlib import Path

directory = Path(sys.argv[1])
tokenizer = json.loads((directory / 'tokenizer.json').read_text(encoding='utf8'))
(directory / 'vocab.json').write_text(
    json.dumps(tokenizer['model']['vocab'], ensure_ascii=False),
    encoding='utf8',
)
PY
fi

step 'Converting to ggml'
"$BUILD_DIR/venv/bin/python" "$BUILD_DIR/convert-h5-to-ggml.py" \
  "$BUILD_DIR/hf" "$BUILD_DIR/whisper" "$BUILD_DIR"

step "Quantizing to $QUANTIZATION"
whisper-quantize "$BUILD_DIR/ggml-model.bin" "$BUILT" "$QUANTIZATION" >/dev/null

step 'Clearing up'
rm -rf "$BUILD_DIR"

printf '\nBuilt %s\n\n' "$BUILT"
ls -lh "$MODELS_DIR"
printf '\nThai now listens with this. `pnpm listen`\n\n'
