# 01 · Soumission indirecte WebGPU — commandes pré-générées, sans LOD ni Hi-Z

## Description
Ce banc isole la soumission indirecte et le culling frustum atomique. Il ne constitue pas le pipeline GPU-driven complet : il n'implémente ni LOD, ni meshlets, ni Hi-Z, ni streaming.

> **Invariant: zero visibility read-back to the CPU.**
> No `mapAsync(READ)`, no blocking read of visibility counters, is tolerated inside the frame loop.

---

## Place dans la chaîne future

```
Phase 1: Remove CPU submit (GPU frustum culling + indirect buffer) ← ce banc
   │
   ▼
Phase 2: Descend the abstraction (Level A TSL → Level B common backend → Level C fork)
   │
   ▼
Phase 3: GPU LOD selection (screen-space error metric, no round-trip)
   │
   ▼
Phase 4: Meshlet partitioning & cluster culling
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
- [`docs/hypothesis.md`](docs/hypothesis.md) — R&D arbitration protocol, decision criteria and switch-over thresholds.
- `implementation/classicScene.ts` — Test A scene and renderer (standard Three.js).
- `implementation/` — Test B experimental mini-renderer (flat storage buffers, compute shader, indirect draw).
- `runner/` — automated measurement harness, high-precision instrumentation and profiling.
- `results/` — collected data (JSON), crossover curves and WebGPU traces.

## Exécution et terminaison

`BenchmarkRunner.runAutomatedBenchmark(tiers?)` est l'API intégrable dans la coque. Elle alterne les modes, parcourt une liste finie de paliers, puis rend un `CrossoverReport`; `finally` restitue systématiquement l'état de campagne. `canRender` sert de garde de propriété et les callbacks `onBenchmarkProgress`, `onMetricsUpdate` et `onBenchmarkComplete` alimentent l'interface.

Le test local vérifie uniquement la génération déterministe et le packing binaire. Une campagne matérielle doit disposer de WebGPU, exécuter les variantes successivement sur le même viewport et ne publier aucun crossover automatique, car la référence utilise WebGL/Three.js et le candidat WebGPU natif.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
