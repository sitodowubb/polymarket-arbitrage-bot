#!/usr/bin/env bash
set -e
MODELS=(llava-1.5-7b llava-1.5-13b qwen2-vl-7b gpt-4o-mini gpt-4o)
mkdir -p predictions
for M in "${MODELS[@]}"; do
  OUT=predictions/${M}.jsonl
  if [ ! -f "$OUT" ]; then
    echo "==> $M"
    svb run --model "$M" --output "$OUT" || true
  fi
done
for M in "${MODELS[@]}"; do
  echo "## $M"
  svb score predictions/${M}.jsonl || true
done
