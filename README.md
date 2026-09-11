<div align="center">

# Render Tech Lab

### Real-time rendering R&D for the web — WebGPU and Three.js TSL, one technique per module, every decision backed by a reproducible benchmark.

[![WebGPU](https://img.shields.io/badge/WebGPU-native-005A9C?logo=webgpu&logoColor=white)](https://www.w3.org/TR/webgpu/)
[![Three.js 0.174](https://img.shields.io/badge/Three.js-0.174-000000?logo=three.js&logoColor=white)](https://threejs.org)
[![TSL](https://img.shields.io/badge/TSL-node%20materials-000000)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite 6](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-1e6fbf)](LICENSE)

**[Modules](#the-eight-modules)** · **[Governing rule](#the-governing-rule)** · **[Benchmarks](#the-s0s5-load-curve)** · **[Reports](reports/README.md)** · **[Watchlist](#conditional-watchlist)**

</div>

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

## The eight modules

| Module | Research subject | Protocol |
|---|---|---|
| [**00-baseline**](00-baseline/README.md) | Reference WebGPU/TSL floor — S0–S5 load curve, golden stills | [hypothesis.md](00-baseline/hypothesis.md) |
| [**01-gpu-driven**](01-gpu-driven/README.md) | GPU-driven rendering, frustum & Hi-Z culling (compute / indirect draw) | [hypothesis.md](01-gpu-driven/hypothesis.md) |
| [**02-nanite-inspired**](02-nanite-inspired/README.md) | Virtualized geometry, meshlets & cluster culling | [hypothesis.md](02-nanite-inspired/hypothesis.md) |
| [**03-virtual-shadow-maps**](03-virtual-shadow-maps/README.md) | Virtual shadow maps (VSM) & paged atlas | [hypothesis.md](03-virtual-shadow-maps/hypothesis.md) |
| [**04-lumen-inspired**](04-lumen-inspired/README.md) | Dynamic global illumination (TSL SSGI, radiance cascades) | [hypothesis.md](04-lumen-inspired/hypothesis.md) |
| [**05-tsr**](05-tsr/README.md) | Temporal super resolution (TSR / TAAU) & upscaling | [hypothesis.md](05-tsr/hypothesis.md) |
| [**06-virtual-textures**](06-virtual-textures/README.md) | Sparse virtual texturing (SVT) & mip streaming | [hypothesis.md](06-virtual-textures/hypothesis.md) |
| [**07-render-graph**](07-render-graph/README.md) | Render graph & transient resource aliasing | [hypothesis.md](07-render-graph/hypothesis.md) |

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
| **S3** | 2 000 unique objects (CPU submission stress) |
| **S4** | 30 dynamic lights (GPU pass stress) |
| **S5** | Hostile (geometry, lights and shadows combined) |

Recorded on every run: `CPU frame`, `GPU frame`, `submitMs`, `P95`, `P99`, `firstStillMs − stillMs`.

- *Linear degradation* → GPU-bound → targeted pass optimisation.
- *Staircase* → CPU submission saturation → targeted architectural decision.

## Execution order

```text
Batch A (00-baseline) ── S0–S5 curve + three gates
  │
  ├── Ceiling not reached ──→ TSL immediate nodes ──→ atmosphere, auto LODs, KTX2, MRT/SSS, WebGPU export runtime
  │
  └── Ceiling reached ──────→ Profile the specific bottleneck
                                ├── CPU submission ──→ smallest quantified action
                                └── GPU / VRAM ──────→ smallest quantified action
```

## Conditional watchlist

These subjects are neither rejected nor scheduled. They stay dormant and only open when a benchmark threshold is crossed:

| Subject | Trigger that would reopen it |
|---|---|
| **Progressive path-traced final render** | A product-value decision (film/reference-image export), not raw performance |
| **GPU-driven rendering, Hi-Z, meshlets** | A proven CPU knee on S3/S5, with a gain larger than the cost of forking Three.js |
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
