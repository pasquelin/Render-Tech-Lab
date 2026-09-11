# 01-gpu-driven — GPU-Driven Rendering Pipeline

## Description
A GPU-driven rendering architecture for Three.js / WebGPU. The core goal is to remove the CPU submission bottleneck (`submitMs` / the sequential draw-call loop) by moving visibility evaluation (culling), level-of-detail selection and render-command emission onto the GPU itself, through compute shaders and `drawIndexedIndirect`.

> **Invariant: zero visibility read-back to the CPU.**
> No `mapAsync(READ)`, no blocking read of visibility counters, is tolerated inside the frame loop.

---

## The five phases of the lab

```
Phase 1: Remove CPU submit (GPU frustum culling + indirect buffer)
   │
   ▼
Phase 2: Descend the abstraction (Level A TSL → Level B common backend → Level C fork)
   │
   ▼
Phase 3: GPU LOD selection (screen-space error metric, no round-trip)
   │
   ▼
Phase 4: Meshlet partitioning & cluster culling (Nanite-style)
   │
   ▼
Phase 5: Hi-Z occlusion culling (depth pyramid + indirect compaction)
```

---

## The four comparative benches (reference scene: 2 000 objects)

| Bench | Name | Culling & LOD | Submission | Key measurement |
|:---:|---|---|---|---|
| **Test A** | **Classic Three.js** | Per-object CPU frustum culling | 2 000 sequential `drawIndexed` through `WebGPURenderer` | CPU submit reference baseline |
| **Test B** | **GPU culling** | GPU compute pass, frustum + atomic compaction | A single `drawIndexedIndirect` | Collapse of `submitMs` |
| **Test C** | **GPU culling + LOD** | GPU frustum + screen-space error metric (LOD0..LOD3) | Multi-LOD `drawIndexedIndirect` | Geometry reduction at no CPU cost |
| **Test D** | **GPU culling + LOD + Hi-Z** | GPU frustum + Hi-Z occlusion + LOD | Compacted `drawIndexedIndirect` | Early rejection of occluded objects |

---

## Finding the crossover point

The harness automatically sweeps four complexity tiers:
- **500 objects**
- **1 000 objects**
- **2 000 objects** (CPU submission stress — scenario S3)
- **5 000 objects**

The point is to trace the load curve and find the exact threshold where GPU compute dispatch overhead becomes cheaper than Three.js's CPU command encoding.

```text
CPU submit (ms)
  ▲
3 │                     ╱ (classic Three.js — O(N))
  │                   ╱
2 │                 ╱
  │   ────────────╱───────── (GPU-driven — O(1) on the CPU)
1 │             ╱
  │           ╱
0 ┼─────────▲───────────────► Object count
  0        1k      2k      5k
           └─ Crossover point
```

---

## Module layout
- [`hypothesis.md`](hypothesis.md) — R&D arbitration protocol, decision criteria and switch-over thresholds.
- `baseline/` — Test A scene and renderer (standard Three.js).
- `implementation/` — Test B experimental mini-renderer (flat storage buffers, compute shader, indirect draw).
- `benchmark/` — automated measurement harness, high-precision instrumentation and profiling.
- `results/` — collected data (JSON), crossover curves and WebGPU traces.
