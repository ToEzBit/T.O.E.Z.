#!/usr/bin/env bash
#
# Builds T.O.E.Z.'s ears: Thonburian Whisper, distilled and quantized, in the
# ggml format whisper.cpp reads (ADR-0003). Also fetches the Silero voice
# activity model, without which Whisper invents words out of silence.
#
# Run once. Everything lands in ~/.toez/models, which is the Workspace, so it
# survives reinstalling the app. Takes a while and wants ~6GB of scratch space:
# the conversion needs PyTorch, and the model is a gigabyte before it is
# quantized. Both are thrown away at the end.
#
# See docs/ears.md.

set -euo pipefail

MODELS_DIR="${TOEZ_MODELS_DIR:-$HOME/.toez/models}"
BUILD_DIR="$MODELS_DIR/.build"

# The distilled medium: four decoder layers instead of twenty-four, which is
# most of Thonburian's accuracy at a fraction of the size (ADR-0003).
HF_MODEL='biodatlab/distill-whisper-th-medium'
MODEL_NAME='ggml-thonburian-distil-medium'
QUANTIZATION='q5_0'

# Pinned to the whisper.cpp release Homebrew installs: the ggml file format and
# the converter that writes it have to agree.
WHISPER_CPP_TAG='v1.9.2'
CONVERTER_URL="https://raw.githubusercontent.com/ggml-org/whisper.cpp/${WHISPER_CPP_TAG}/models/convert-h5-to-ggml.py"

# Whisper's mel filterbank, which lives in OpenAI's repo rather than in the
# fine-tune, and which the converter copies into the ggml file.
MEL_FILTERS_URL='https://raw.githubusercontent.com/openai/whisper/main/whisper/assets/mel_filters.npz'

VAD_MODEL='ggml-silero-v5.1.2.bin'
VAD_URL="https://huggingface.co/ggml-org/whisper-vad/resolve/main/${VAD_MODEL}"

say() { printf '\n▸ %s\n' "$1"; }

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

say "Voice activity model → $MODELS_DIR/$VAD_MODEL"
if [ -f "$MODELS_DIR/$VAD_MODEL" ]; then
  echo '  already here'
else
  curl -fL --progress-bar -o "$MODELS_DIR/$VAD_MODEL" "$VAD_URL"
fi

if [ -f "$MODELS_DIR/$MODEL_NAME-$QUANTIZATION.bin" ]; then
  say "$MODEL_NAME-$QUANTIZATION.bin is already built — delete it to rebuild."
  exit 0
fi

say 'PyTorch, for the conversion only'
if [ ! -x "$BUILD_DIR/venv/bin/python" ]; then
  python3 -m venv "$BUILD_DIR/venv"
fi
"$BUILD_DIR/venv/bin/pip" install --quiet --upgrade pip
"$BUILD_DIR/venv/bin/pip" install --quiet torch transformers numpy huggingface_hub

say "$HF_MODEL"
"$BUILD_DIR/venv/bin/python" - "$HF_MODEL" "$BUILD_DIR/hf" <<'PY'
import sys
from huggingface_hub import snapshot_download

# Weights and tokenizer only: the repo also carries training logs and images.
snapshot_download(
    sys.argv[1],
    local_dir=sys.argv[2],
    allow_patterns=['*.json', '*.txt', '*.safetensors'],
)
PY

say 'Converter and mel filterbank'
curl -fLs -o "$BUILD_DIR/convert-h5-to-ggml.py" "$CONVERTER_URL"
mkdir -p "$BUILD_DIR/whisper/whisper/assets"
curl -fLs -o "$BUILD_DIR/whisper/whisper/assets/mel_filters.npz" "$MEL_FILTERS_URL"

# The converter reads the byte-level BPE vocabulary from vocab.json, which this
# fine-tune does not ship separately — it is inside tokenizer.json instead.
if [ ! -f "$BUILD_DIR/hf/vocab.json" ]; then
  say 'Recovering vocab.json from tokenizer.json'
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

say 'Converting to ggml'
"$BUILD_DIR/venv/bin/python" "$BUILD_DIR/convert-h5-to-ggml.py" \
  "$BUILD_DIR/hf" "$BUILD_DIR/whisper" "$BUILD_DIR"
mv "$BUILD_DIR/ggml-model.bin" "$BUILD_DIR/$MODEL_NAME.bin"

say "Quantizing to $QUANTIZATION"
whisper-quantize \
  "$BUILD_DIR/$MODEL_NAME.bin" \
  "$MODELS_DIR/$MODEL_NAME-$QUANTIZATION.bin" \
  "$QUANTIZATION" >/dev/null

say 'Clearing up'
rm -rf "$BUILD_DIR"

printf '\nT.O.E.Z. has ears. `pnpm listen`.\n\n'
ls -lh "$MODELS_DIR"
