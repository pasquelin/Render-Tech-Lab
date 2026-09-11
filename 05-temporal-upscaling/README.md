# 05-tsr — Temporal Super Resolution (TSR / TAAU)

## Description
Temporal upscaling and anti-aliasing algorithms (sub-pixel reprojection with jittering and motion vectors) to lower native resolution without giving up sharpness.

## Validation protocol
Every study follows the governing cycle, in order:

```text
Hypothesis → Prototype → Benchmark → Profiling → Gain → Cost → Decision
```

Fill in and keep [`hypothesis.md`](hypothesis.md) up to date at every step of the investigation.

## Module layout
- `hypothesis.md` — scoping sheet, experimental protocol, metrics and final verdict.
- `baseline/` — reference implementation or scene (current engine, without the technique).
- `implementation/` — experimental prototype of the new architecture / pass.
- `benchmark/` — automated test scripts and reproducible load scenarios.
- `results/` — capture traces, measured metrics, charts and visual comparisons.
