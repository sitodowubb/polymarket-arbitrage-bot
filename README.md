# Spatial-VQA-Bench
> A small, focused benchmark of *spatial* visual reasoning for multimodal LLMs — left/right, behind/in-front, near/far, and "if I rotated this 90°".

## Overview

Most VQA benchmarks treat spatial reasoning as a sub-task — a thin slice on top of object recognition and counting. The numbers therefore wash out: a model that aces "what colour is the umbrella" can score similarly to a model that actually understands that *the umbrella is behind the bench*. Spatial-VQA-Bench tries to isolate that signal.

It's 3,200 hand-vetted items across **five** task families:

- **2D-relations** — left of / right of / above / below / between
- **3D-relations** — in front of / behind / nearer / farther
- **Rotation** — "if I rotated this object 90° clockwise, which way does X point?"
- **Occlusion** — questions about hidden / partially-occluded objects
- **Viewpoint** — "what would the back of this look like?"

Images are sourced from indoor scenes (ScanNet renders, OpenImages indoor) and synthetic 3D scenes for the rotation/viewpoint tasks.

## Architecture

```
items.jsonl ──▶ runner ──▶ model adapter ──▶ predictions.jsonl
                                                    │
                                                    ▼
                                              scorer ──▶ {acc/family}
```

Each item is a dict with `id`, `task`, `image`, `question`, `choices`, `answer`. Items are open-ended but always have a CMC version available.

## Installation

```bash
pip install -e ".[full]"
```

## Quick Start

```bash
# evaluate one model
svb run --model qwen2-vl-7b --output predictions/qwen2-vl-7b.jsonl

# score predictions
svb score predictions/qwen2-vl-7b.jsonl --report

# reproduce Table 2 (all baseline models, all tasks)
bash scripts/repro_table2.sh
```

## Benchmarks

| Model              | 2D-rel | 3D-rel | Rot. | Occl. | Viewp. | Avg  |
|--------------------|--------|--------|------|-------|--------|------|
| Random             | 25.0   | 25.0   | 25.0 | 25.0  | 25.0   | 25.0 |
| LLaVA-1.5-7B       | 51.2   | 38.4   | 30.2 | 47.0  | 32.1   | 39.8 |
| LLaVA-1.5-13B      | 54.0   | 41.7   | 32.4 | 50.5  | 34.9   | 42.7 |
| Qwen2-VL-7B        | 66.3   | 52.0   | 42.1 | 61.2  | 45.7   | 53.5 |
| InternVL2-8B       | 65.1   | 50.6   | 41.4 | 60.0  | 44.9   | 52.4 |
| GPT-4o-mini        | 70.4   | 56.7   | 47.8 | 65.3  | 51.0   | 58.2 |
| GPT-4o             | 76.5   | 63.4   | 55.2 | 71.1  | 58.9   | 65.0 |
| Human              | 92.8   | 89.5   | 84.7 | 91.0  | 86.4   | 88.9 |

Patterns we see:

- All models struggle most on **rotation** and **viewpoint** — these require mental simulation, not just direct perception.
- The gap between LLaVA-1.5-7B and Qwen2-VL-7B is large on 3D-relations (+13.6 pts) but narrow on 2D-relations (+15.1) — Qwen2-VL really does seem to have a stronger 3D prior.

## Citation

```bibtex
@misc{spatialvqabench,
  author = {Boyang Ma},
  title  = {Spatial-VQA-Bench: A Benchmark of Spatial Visual Reasoning for MLLMs},
  year   = {2025},
  url    = {https://github.com/sitodowubb/spatial-vqa-bench}
}
```

## License

MIT.
