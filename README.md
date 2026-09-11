<div align="center">

# Render Tech Lab

### Real-time rendering R&D for the web — WebGPU and Three.js TSL, one technique per module, every decision backed by a reproducible benchmark.

[![WebGPU](https://img.shields.io/badge/WebGPU-native-005A9C?logo=webgpu&logoColor=white)](https://www.w3.org/TR/webgpu/)
[![Three.js 0.174](https://img.shields.io/badge/Three.js-0.174-000000?logo=three.js&logoColor=white)](https://threejs.org)
[![TSL](https://img.shields.io/badge/TSL-node%20materials-000000)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite 6](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-1e6fbf)](LICENSE)

**[Master Test Plan](MASTER_TEST_PLAN.md)** · **[Governing rule](#the-governing-rule)** · **[Benchmarks](#the-s0s5-load-curve)** · **[Reports](reports/README.md)** · **[Watchlist](#conditional-watchlist)**

</div>

---

## Master Test Plan & Execution Contract

The laboratory is governed by **[`MASTER_TEST_PLAN.md`](MASTER_TEST_PLAN.md)**, defining 14 isolated unit test blocks (from `00-baseline` through `13-full-gpu-driven`) before developing proprietary mathematical optimization models.

> **Philosophical Principle :**  
> Nanite is an architectural inspiration, not a specification to duplicate blindly. The lab determines experimentally which properties make GPU-driven rendering viable in WebGPU / Three.js, using simple, reproducible unit tests.

---

## The governing rule

> **No major infrastructure is adopted because it is standard in modern engines. It is adopted when a reproducible benchmark proves that the current architecture is the limiting factor, and when the expected gain is quantified.**
>
> *Corollary: the benchmark has to prove the studio has a problem before the engine is allowed to grow more complex.*

The goal is not *"the engine that renders the largest possible world"*. It is the best **visual quality / interaction latency / stability / GPU cost** ratio for the scenes this studio actually authors and ships.

Every module follows the same cycle, and nothing merges into the main engine without going through all seven steps:

```text
Hypothesis → Prototype → Benchmark → Profiling → Gain → Cost → Decision
```

## Methodology: Two Levels of Baseline

To guarantee mathematical and scientific rigor across reports, the laboratory strictly distinguishes two tiers of measurement:

1. **Official Baseline (Spec 13 Witness Floor)**:
   - Fixed, normalized witness matrix under frozen Spec 13 reference conditions (S0 to S5).
   - Identifies the contractual bottleneck knee: scenario **S3 (2 000 unique meshes)** saturated CPU submission at **3.35 ms / 2 002 draw calls**, officially unlocking and requiring GPU-driven R&D.
2. **Live Comparative A/B Benchmarks**:
   - Synchronous, side-by-side execution on the active testbench (Test A Three.js vs Test B Prototype).
   - Conducted under strictly identical realtime conditions: same browser instance, same GPU, same canvas resolution, same dynamic orbital camera, and identical warmup protocol.
   - Measures direct speed-up ($O(N)$ vs $O(1)$) across live geometric and stress tiers.

## The R&D Progression

Instead of jumping prematurely to a monolithic Nanite clone, the laboratory builds progressively:

| Module | Research subject | Status | Protocol |
|---|---|---|---|
| [**00-baseline**](00-baseline/README.md) | Baseline Spec 13 Witness — S0–S5 load curve, reference floor | **Validé** | [hypothesis.md](00-baseline/hypothesis.md) |
| [**01-gpu-driven**](01-gpu-driven/README.md) | GPU-Driven Indirect Draw & Frustum Culling Compute WGSL (1 draw call) | **Validé** | [hypothesis.md](01-gpu-driven/hypothesis.md) |
| [**02-gpu-scene**](02-gpu-scene/README.md) | Heterogeneous GPU Scene (`Object`, `Geometry`, `Material`, `Draw` buffers, 4D stress) | **En cours (Actif)** | [hypothesis.md](02-gpu-scene/hypothesis.md) |
| **03-gpu-lod** | GPU LOD selection by screen-space projected error in compute | *Prévu* | hypothesis.md |
| **04-meshlets** | Meshlet hierarchy (meshoptimizer), cluster-level culling & compaction | *Prévu* | hypothesis.md |
| **05-hiz** | Hi-Z depth pyramid & two-phase occlusion culling (90% occlusion stress) | *Prévu* | hypothesis.md |
| **06-gpu-material** | Visibility buffer & deferred material shading | *Prévu* | hypothesis.md |

Each module holds the same five drawers: `hypothesis.md` (scoping sheet and final verdict), `baseline/` (the current engine, without the technique), `implementation/` (the experimental prototype), `benchmark/` (automated, reproducible load scenarios) and `results/` (captures, figures, visual comparisons).

**Cross-cutting:** [`benchmarks/`](benchmarks/README.md) holds the shared metric harnesses (`cpu`, `gpu`, `memory`, `image-quality`); [`reports/`](reports/README.md) holds the consolidated arbitration reports.

## The three independent gates

A prototype is never judged on a single number. It has to clear three gates that fail for different reasons:

| Gate | Measurement | What it catches |
|---|---|---|
| **Visual** | Golden still, root-mean-square (RMS) deviation | Pixel drift, display regressions |
| **Steady state** | `stillMs`, `gpuFrameMs`, per-stage budget, P95/P99 | Over-expensive pass, GPU saturation, micro-stutter |
| **Cold → warm** | `firstStillMs − stillMs`, explicit threshold | WebGPU pipeline compilation stalls |

## The S0–S5 load curve

Instead of one comfortable benchmark, the harness runs a parameterised suite and looks for the knee in the curve:

| Scenario | Load |
|---|---|
| **S0** | Minimal baseline |
| **S1** | 500 instanced objects |
| **S2** | 1 000 instanced objects |
| **S3** | 2 000 unique objects (CPU submission stress — **3.35 ms / 2 002 draw calls**) |
| **S4** | 30 dynamic lights (GPU pass stress) |
| **S5** | Hostile (geometry, lights and shadows combined — **8.45 ms**) |

Recorded on every run: `CPU frame`, `GPU frame`, `submitMs`, `P95`, `P99`, `firstStillMs − stillMs`.

- *Linear degradation* → GPU-bound → targeted pass optimisation.
- *Staircase* → CPU submission saturation → targeted architectural decision.

## Execution roadmap

```text
00-baseline (Spec 13 S0–S5)          ← VALIDÉ (Knee at S3 / 3.35 ms)
     │
     ▼
01-gpu-driven (Indirect Draw WGSL)   ← VALIDÉ (1 draw call, crossover ~500 obj)
     │
     ▼
02-gpu-scene (Heterogeneous Scene)   ← BANC ACTIF (Object, Geometry, Material, Draw Buffers, 4D stress)
     │
     ▼
03-gpu-lod (Screen-Space Error)      ← Prochaine étape
     │
     ▼
04-meshlets (Cluster Culling)        ← Échelle Nanite
     │
     ▼
05-hiz (Occlusion Pyramid)           ← Occlusion 90%
     │
     ▼
06-gpu-material / visibility         ← Visibility Buffer
```

## Conditional watchlist

These subjects are neither rejected nor scheduled. They stay dormant and only open when a benchmark threshold is crossed:

| Subject | Trigger that would reopen it |
|---|---|
| **Progressive path-traced final render** | A product-value decision (film/reference-image export), not raw performance |
| **GPU-driven rendering, Hi-Z culling, meshlets** | A proven CPU knee on S3/S5, with a gain larger than the cost of forking Three.js |
| **Render graph & transient aliasing** | Render-target allocations proven to dominate bandwidth |
| **Texture streaming, mip residency** | A proven VRAM budget overrun on a real project |
| **Dynamic resolution scaling (DRS)** | After the TSL batch, if frame time becomes unstable during interaction |
| **3D radiance cascades** | Industrial maturity for 3D on the web |
| **Animation / simulation LOD, 100 km² worlds** | Outside the studio's current target |
| **Gaussian splatting (3DGS)** | One of the studio's AI providers starts emitting it → read-only format |

## Running it

```bash
pnpm install
pnpm dev       # interactive lab viewer (Vite)
pnpm bench     # crossover benchmark, 01-gpu-driven
pnpm build     # type-check + production build
```

Requires a browser with WebGPU enabled (Chrome/Edge 113+, Safari 18+). Reports are written next to each module in `results/` and mirrored into [`reports/`](reports/README.md).

## Status

This is a research repository, not a library: modules are prototypes kept deliberately isolated from any production engine, and an unfavourable verdict is as valid a result as a merge. Published under the [MIT licence](LICENSE) so the benchmarks and findings can be reused and contested.
