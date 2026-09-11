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

Instead of jumping prematurely to a monolithic Nanite clone, the laboratory builds progressively. The table below reflects the **actual** state of the repository and the governing statuses, kept in sync with [`MASTER_TEST_PLAN.md`](MASTER_TEST_PLAN.md).

> **Status legend (honest by construction):**
> - **[VALIDATED]** — benchmark executed and archived (`results/REPORT.md`), verdict recorded.
> - **[IMPLEMENTED]** — prototype + benchmark code present, campaign measured (not yet a cross-bench verdict).
> - **[NOT IMPLEMENTED / NOT RUN]** — structure, contracts and fixtures present; **no benchmark executed, no number claimed** (`results/latest.json` = `status: "not-run"`).

| Module | Research subject | Status | Protocol |
|---|---|---|---|
| [**00-baseline**](00-baseline/README.md) | Spec 13 Witness — S0–S5 load curve, reference floor | **[VALIDATED]** | [hypothesis.md](00-baseline/hypothesis.md) |
| [**01-indirect-draw**](01-indirect-draw/README.md) | Indirect Draw (1 draw call) + baseline crossover | **[VALIDATED]** | [hypothesis.md](01-indirect-draw/hypothesis.md) |
| [**02-gpu-frustum-culling**](02-gpu-frustum-culling/README.md) | Compute WGSL frustum culling (plan/sphere) | **[NOT IMPLEMENTED / NOT RUN]** | [hypothesis.md](02-gpu-frustum-culling/hypothesis.md) |
| [**03-gpu-scene**](03-gpu-scene/README.md) | Heterogeneous GPU scene (Object/Geometry/Material/Draw buffers, 4D stress) | **[VALIDATED]** | [hypothesis.md](03-gpu-scene/hypothesis.md) |
| [**04-gpu-lod**](04-gpu-lod/README.md) | Screen-Space Error LOD, decimation (meshoptimizer) + CPU/GPU selection | **[VALIDATED]** 04A/04B · 04C not run | [hypothesis.md](04-gpu-lod/hypothesis.md) |
| [**05-meshlets**](05-meshlets/README.md) | Cluster partitioning (64/128/256/512 tris) & overhead | **[NOT IMPLEMENTED / NOT RUN]** | [types.ts](05-meshlets/types.ts) |
| [**06-meshlet-culling**](06-meshlet-culling/README.md) | Frustum / backface / sub-pixel cluster culling & reject rate | **[NOT IMPLEMENTED / NOT RUN]** | [types.ts](06-meshlet-culling/types.ts) |
| [**07-hiz**](07-hiz/README.md) | Hi-Z depth pyramid (mip 0 → N) & generation cost | **[NOT IMPLEMENTED / NOT RUN]** | [types.ts](07-hiz/types.ts) |
| [**08-occlusion-culling**](08-occlusion-culling/README.md) | Hi-Z occlusion under 10%–99% & net-gain equation | **[NOT IMPLEMENTED / NOT RUN]** | [types.ts](08-occlusion-culling/types.ts) |
| [**09-gpu-compaction**](09-gpu-compaction/README.md) | Visible-list compaction (1-thread / atomic / scan) | **[NOT IMPLEMENTED / NOT RUN]** | [types.ts](09-gpu-compaction/types.ts) |
| [**10-material-batching**](10-material-batching/README.md) | Materialisation (switch / storage / texture-array) | **[NOT IMPLEMENTED / NOT RUN]** | [types.ts](10-material-batching/types.ts) |
| [**11-geometry-streaming**](11-geometry-streaming/README.md) | VRAM residency & memory-pressure lifecycle | **[NOT IMPLEMENTED / NOT RUN]** | [types.ts](11-geometry-streaming/types.ts) |
| [**12-visibility-buffer**](12-visibility-buffer/README.md) | Visibility buffer & deferred shading | **[NOT IMPLEMENTED / NOT RUN]** | [types.ts](12-visibility-buffer/types.ts) |
| [**13-full-gpu-driven**](13-full-gpu-driven/README.md) | Assembled pipeline & systemic cost/gain balance | **[NOT IMPLEMENTED / NOT RUN]** | [types.ts](13-full-gpu-driven/types.ts) |

Each module holds the same drawers: `hypothesis.md` (scoping sheet and final verdict), `baseline/` (reference engine, without the technique), `implementation/` (the experimental prototype), `benchmark/` (automated, reproducible load scenarios) and `results/` (captures, figures, comparisons, and `latest.json`).

**Cross-cutting:** [`shared/`](shared/) holds the neutral, strictly comparable primitives (`gpu`, `scene`, `fixtures`, `benchmark`, `math`) that every bench shares; [`benchmarks/`](benchmarks/README.md) holds the metric harnesses; [`reports/`](reports/README.md) holds the consolidated arbitration reports.

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
 0   00-baseline            (Spec 13 S0–S5)            ← [VALIDATED]
 1   01-indirect-draw       (Indirect Draw, 1 call)    ← [VALIDATED]
 2   02-gpu-frustum-culling (Compute WGSL culling)     ← [NOT IMPLEMENTED / NOT RUN]
 3   03-gpu-scene           (Heterogeneous scene)      ← [VALIDATED]
 4   04-gpu-lod             (Screen-Space Error LOD)   ← [VALIDATED]
 5   05-meshlets            (Cluster partitioning)     ← [NOT IMPLEMENTED / NOT RUN]
 6   06-meshlet-culling     (Frustum / cone / sub-pix) ← [NOT IMPLEMENTED / NOT RUN]
 7   07-hiz                 (Hi-Z depth pyramid)       ← [NOT IMPLEMENTED / NOT RUN]
 8   08-occlusion-culling   (Hi-Z occlusion 10%–99%)   ← [NOT IMPLEMENTED / NOT RUN]
 9   09-gpu-compaction      (Visible-list compaction)  ← [NOT IMPLEMENTED / NOT RUN]
10   10-material-batching   (switch / storage / array) ← [NOT IMPLEMENTED / NOT RUN]
11   11-geometry-streaming  (VRAM residency pressure)  ← [NOT IMPLEMENTED / NOT RUN]
12   12-visibility-buffer   (Visibility + deferred)    ← [NOT IMPLEMENTED / NOT RUN]
13   13-full-gpu-driven     (Assembled pipeline)       ← [NOT IMPLEMENTED / NOT RUN]
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
pnpm bench     # crossover benchmark, 01-indirect-draw
pnpm bench:lod # LOD suite, 04-gpu-lod
pnpm test      # unit tests (SSE / LOD / random / meshlet / schema)
pnpm build     # type-check + production build
```

Requires a browser with WebGPU enabled (Chrome/Edge 113+, Safari 18+). Reports are written next to each module in `results/` and mirrored into [`reports/`](reports/README.md).

## Status

This is a research repository, not a library: modules are prototypes kept deliberately isolated from any production engine, and an unfavourable verdict is as valid a result as a merge. Published under the [MIT licence](LICENSE) so the benchmarks and findings can be reused and contested.
