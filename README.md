<div align="center">

# Render Tech Lab

### Real-time rendering R&D for the web — WebGPU and Three.js TSL, one technique per module, every decision backed by a reproducible benchmark.

[![WebGPU](https://img.shields.io/badge/WebGPU-native-005A9C?logo=webgpu&logoColor=white)](https://www.w3.org/TR/webgpu/)
[![Three.js 0.174](https://img.shields.io/badge/Three.js-0.174-000000?logo=three.js&logoColor=white)](https://threejs.org)
[![TSL](https://img.shields.io/badge/TSL-node%20materials-000000)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite 6](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-1e6fbf)](LICENSE)

**[Principes du Lab](docs/PRINCIPES_DU_LAB.md)** · **[Governing rule](#the-governing-rule)** · **[Benchmarks](#the-s0s5-load-curve)** · **[Rapports](reports/README.md)**

</div>

Documentation : [méthodologie et preuves du Lab](docs/README.md) · [conception de Web Geometry](../webGeometry/docs/README.md).

---

## Master Test Plan & Execution Contract

The laboratory contains a Dashboard and 15 experimental benches (`01`–`15`), plus the consultative baseline `00`. [`docs/PRINCIPES_DU_LAB.md`](docs/PRINCIPES_DU_LAB.md) is the canonical policy.

> **Philosophical Principle :**  
> Nanite is an architectural inspiration, not a specification to duplicate blindly. The lab determines experimentally which properties make GPU-driven rendering viable in WebGPU / Three.js, using simple, reproducible unit tests.

---

## The governing rule

The canonical architecture and evidence rules are maintained in **[`docs/PRINCIPES_DU_LAB.md`](docs/PRINCIPES_DU_LAB.md)**. This README introduces them; module documentation must link to that source instead of creating competing versions.

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
   - The former S3/S5 timings were hardcoded in Node. They are archived as unverified; the physical crossover must be remeasured.
2. **Live Comparative A/B Benchmarks**:
   - Synchronous, side-by-side execution on the active testbench (Test A Three.js vs Test B Prototype).
   - Conducted under strictly identical realtime conditions: same browser instance, same GPU, same canvas resolution, same dynamic orbital camera, and identical warmup protocol.
   - The native benchmark compares direct/indirect draws, atomic/workgroup culling and serial/atomic/workgroup compaction. Cross-engine WebGL/WebGPU timings do not isolate an algorithmic gain.

## The R&D Progression

Instead of jumping prematurely to a monolithic Nanite clone, the laboratory builds progressively. The table below reflects the **actual** state of the repository and the governing statuses.

> **Status legend (honest by construction):**
> - **[RE-MEASURE]** — historical verdict withdrawn pending a reproducible physical campaign.
> - **[IMPLEMENTED]** — prototype code present; execution and evidence must be checked per module.
> - **[NOT IMPLEMENTED / NOT RUN]** — structure, contracts and fixtures present; **no benchmark executed, no number claimed** (`results/latest.json` = `status: "not-run"`).

| Module | Research subject | Status | Protocol |
|---|---|---|---|
| [**00-baseline**](00-baseline/README.md) | Spec 13 Witness — S0–S5 load curve, reference floor | **[RE-MEASURE]** | [protocol.md](00-baseline/docs/protocol.md) |
| [**01-indirect-draw**](01-indirect-draw/README.md) | Indirect Draw (1 draw call) + baseline crossover | **[RE-MEASURE]** | [protocol.md](01-indirect-draw/docs/protocol.md) |
| [**02-gpu-frustum-culling**](02-gpu-frustum-culling/README.md) | Compute WGSL frustum culling (plan/sphere) | **[IMPLEMENTED / RE-MEASURE]** | [protocol.md](02-gpu-frustum-culling/docs/protocol.md) |
| [**03-gpu-scene**](03-gpu-scene/README.md) | Heterogeneous GPU scene (Object/Geometry/Material/Draw buffers, 4D stress) | **[RE-MEASURE]** | [protocol.md](03-gpu-scene/docs/protocol.md) |
| [**04-gpu-lod**](04-gpu-lod/README.md) | Screen-Space Error LOD, decimation (meshoptimizer) + CPU/GPU selection | **[RE-MEASURE]** 04A/04B · 04C not run | [protocol.md](04-gpu-lod/docs/protocol.md) |
| [**05-meshlets**](05-meshlets/README.md) | Cluster partitioning (64/128/256/512 tris) & overhead | **[NOT IMPLEMENTED / NOT RUN]** | [protocol.md](05-meshlets/docs/protocol.md) |
| [**06-meshlet-culling**](06-meshlet-culling/README.md) | Frustum / backface / sub-pixel cluster culling & reject rate | **[NOT IMPLEMENTED / NOT RUN]** | [protocol.md](06-meshlet-culling/docs/protocol.md) |
| [**07-hiz**](07-hiz/README.md) | Hi-Z depth pyramid (mip 0 → N) & generation cost | **[NOT IMPLEMENTED / NOT RUN]** | [protocol.md](07-hiz/docs/protocol.md) |
| [**08-occlusion-culling**](08-occlusion-culling/README.md) | Hi-Z occlusion under 10%–99% & net-gain equation | **[NOT IMPLEMENTED / NOT RUN]** | [protocol.md](08-occlusion-culling/docs/protocol.md) |
| [**09-gpu-compaction**](09-gpu-compaction/README.md) | Visible-list compaction (1-thread / atomic / scan) | **[IMPLEMENTED / RE-MEASURE]** | [protocol.md](09-gpu-compaction/docs/protocol.md) |
| [**10-material-batching**](10-material-batching/README.md) | Materialisation (switch / storage / texture-array) | **[NOT IMPLEMENTED / NOT RUN]** | [protocol.md](10-material-batching/docs/protocol.md) |
| [**11-geometry-streaming**](11-geometry-streaming/README.md) | VRAM residency & memory-pressure lifecycle | **[NOT IMPLEMENTED / NOT RUN]** | [protocol.md](11-geometry-streaming/docs/protocol.md) |
| [**12-visibility-buffer**](12-visibility-buffer/README.md) | Visibility buffer & deferred shading | **[NOT IMPLEMENTED / NOT RUN]** | [protocol.md](12-visibility-buffer/docs/protocol.md) |
| [**13-full-gpu-driven**](13-full-gpu-driven/README.md) | Assembled pipeline & systemic cost/gain balance | **[NOT IMPLEMENTED / NOT RUN]** | [protocol.md](13-full-gpu-driven/docs/protocol.md) |
| [**14-open-world**](14-open-world/README.md) | Resident WebGL2 open-world pressure test | **[MEASURED, BOUNDED EVIDENCE]** | [protocol.md](14-open-world/docs/protocol.md) |
| [**15-virtualized-integration**](15-virtualized-integration/README.md) | Prepared virtualized geometry integration | **[PARTIAL PHYSICAL VALIDATION]** | [protocol.md](15-virtualized-integration/docs/protocol.md) |

Bench 15 has separate public packages and a compiled, executed Rust library/CLI preparer with an internal native preparation cache. In Chrome, an Emerald Square slice of 149,998 triangles loaded successfully; two poses passed exact-pixel checks and four measurement blocks completed. Beauty, wireframe, clusters, LOD, error and page diagnostics work on that fixture. The complete city is visible, but its strict A/A control remains unstable, so full-city measurements are blocked and bench 15 is not complete. Injectable ports/stages, general simplification and eviction, native integration, and multiplatform performance CI remain open.

All sixteen benches use the canonical layout and public boundaries described in [the laboratory principles](docs/PRINCIPES_DU_LAB.md#structure-des-bancs-0015). Run `npm run test:structure` to verify the layout, metadata and public imports. No legacy forwarding files remain; HTML routes and existing results are retained.

**Cross-cutting:** [`shared/contracts/`](shared/contracts/) holds the shared interfaces and contracts; [`shared/archive/`](shared/archive/) manages report persistence; [`shared/`](shared) holds the neutral, strictly comparable primitives (`gpu`, `scene`, `fixtures`, `benchmark`, `math`) that every bench shares; [`benchmarks/`](benchmarks/README.md) holds the metric harnesses; [`reports/`](reports/README.md) holds the consolidated arbitration reports.

Product architecture, portable compilation, capabilities and fallback behavior have their canonical specification in [Web Geometry’s product principles](../webGeometry/docs/architecture/PRINCIPES_DU_PRODUIT.md). The Lab owns the evidence required to accept an implementation; its [proof policy](docs/PRINCIPES_DU_LAB.md) governs each campaign.

Web Geometry now contains the native compiler, runtime sources and public SDK exports. The main Lab project consumes the local SDK and bench 15 opens Emerald Square for interactive exploration. Full-city comparison remains disabled while its strict A/A image gate is unstable; the procedural fixture remains a separate scene for targeted campaigns.

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
| **S3** | 2 000 unique objects (CPU submission stress — timings to remeasure) |
| **S4** | 30 dynamic lights (GPU pass stress) |
| **S5** | Hostile (geometry, lights and shadows combined — timings to remeasure) |

Recorded on every run: `CPU frame`, `GPU frame`, `submitMs`, `P95`, `P99`, `firstStillMs − stillMs`.

- *Linear degradation* → GPU-bound → targeted pass optimisation.
- *Staircase* → CPU submission saturation → targeted architectural decision.

## Execution roadmap

```text
 0   00-baseline            (Spec 13 S0–S5)            ← [RE-MEASURE]
 1   01-indirect-draw       (Indirect Draw, 1 call)    ← [RE-MEASURE]
 2   02-gpu-frustum-culling (Compute WGSL culling)     ← [IMPLEMENTED / RE-MEASURE]
 3   03-gpu-scene           (Heterogeneous scene)      ← [RE-MEASURE]
 4   04-gpu-lod             (Screen-Space Error LOD)   ← [RE-MEASURE]
 5   05-meshlets            (Cluster partitioning)     ← [NOT IMPLEMENTED / NOT RUN]
 6   06-meshlet-culling     (Frustum / cone / sub-pix) ← [NOT IMPLEMENTED / NOT RUN]
 7   07-hiz                 (Hi-Z depth pyramid)       ← [NOT IMPLEMENTED / NOT RUN]
 8   08-occlusion-culling   (Hi-Z occlusion 10%–99%)   ← [NOT IMPLEMENTED / NOT RUN]
 9   09-gpu-compaction      (Visible-list compaction)  ← [IMPLEMENTED / RE-MEASURE]
10   10-material-batching   (switch / storage / array) ← [NOT IMPLEMENTED / NOT RUN]
11   11-geometry-streaming  (VRAM residency pressure)  ← [NOT IMPLEMENTED / NOT RUN]
12   12-visibility-buffer   (Visibility + deferred)    ← [NOT IMPLEMENTED / NOT RUN]
13   13-full-gpu-driven     (Assembled pipeline)       ← [NOT IMPLEMENTED / NOT RUN]
14   14-open-world          (WebGL2 adaptive culling)  ← [MEASURED, BOUNDED EVIDENCE]
15   15-virtualized-integration (Prepared geometry)    ← [PARTIAL PHYSICAL VALIDATION]
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

## Composants React obligatoires d’un banc

La coque du Lab appartient à `src/components`, jamais à un banc. Toute route 00–15 utilise `LabShell` et `LabSection` pour les quatre panneaux dans l’ordre :
1. **Configuration / mode d’exécution**
2. **Métriques en direct**
3. **Campagne / comparaison**
4. **Rapports et suivi**

Les contrôles utilisent les primitives communes `Field`, `Select`, `Input`, `Button` et `SegmentedControl`. Les quatre mesures principales passent exclusivement par `LabStats`/`StatsGrid` (`CPU submit`, `CPU frame`, `FPS`, `Draw calls`, affichant `Non mesuré` en cas d'absence), puis les mesures propres au banc par `MetricGrid`. Les états d’attente, chargement et erreur utilisent `EmptyState`, `LoadingState`, `ErrorState` et `ProgressPanel`. Un banc fournit ses libellés, options, métriques et actions par son descriptor/adapter public ; aucune primitive commune ne contient de donnée métier d’un banc.

### Cycle de vie obligatoire
Chaque banc suit strictement le cycle :
```text
idle → loading → running → completed | stopped | error
```
À l’état `idle`, afficher uniquement la fiche et le CTA central de lancement : aucun canvas, moteur, animation ou chargement lourd n’est instancié avant ce clic.

`test/labStatsContract.test.ts` vérifie les seize routes et tous les états de la machine. `test/uiPrimitives.test.ts` verrouille les classes DaisyUI et les associations label/contrôle. `test/labArchitecture.test.ts` garantit l'arborescence canonique et l'isolation des imports.

## Running it

```bash
npm install            # installation des dépendances
npm run dev            # viewer interactif du Lab (Vite)
npm run validate       # qualification complète : tests unitaires + intégration + comparaison + build
npm test               # tests unitaires CPU, oracles mathématiques, contrats et structure
npm run test:structure # contrôle canonique des 16 bancs et isolation des imports publics
npm run test:integration # tests physiques du banc 15 (GPU residency, fences, pool)
npm run test:comparison  # tests de comparaison (LOD 04, monde ouvert 14)
npm run bench          # campagnes physiques matérielles (01, 02, 09)
npm run build          # type-check TypeScript strict (tsc) + production build
```

The CLI uses installed Chrome with a physical WebGPU adapter; it rejects software adapters and missing samples. Set `RTL_BROWSER_CHANNEL` to another installed Playwright channel if needed. `node bench/run.mjs --smoke --fallback` verifies queue-completion timing after building. Full campaigns write raw data, Markdown and SVG in `benchmark-runs/measurements/` and update `results/latest.json`. Smoke checks use `benchmark-runs/checks/` and never promote a performance result. Other GPU module commands fail explicitly with `not-run` until their physical runner exists. Historical reports and `results/legacy-unverified/` are not performance evidence.

## Status

This is a research repository, not a library: modules are prototypes kept deliberately isolated from any production engine, and an unfavourable verdict is as valid a result as a merge. Published under the [MIT licence](LICENSE) so the benchmarks and findings can be reused and contested.
