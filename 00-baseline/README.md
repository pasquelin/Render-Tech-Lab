# 00 · Référence Three.js — coût du graphe de scène S0 à S5

## Description
Reference WebGPU/TSL harness measuring the current engine across the S0 to S5 scenarios. It is the zero point every other module is compared against.

**Ce qui tourne réellement :** une scène Three.js WebGL de référence, sans pipeline GPU-driven. Les dispositions sont déterministes. Le test local vérifie la construction et la reproductibilité ; seule une campagne navigateur peut produire des FPS ou un temps GPU.

**Terminaison et justesse :** les six scénarios forment une liste finie. Chaque scénario doit être constructible deux fois avec des matrices identiques et libérer ses objets à la fin. Un échec de construction ou de reproductibilité invalide la campagne avant toute mesure.

## Validation protocol
Every study follows the governing cycle, in order:

```text
Hypothesis → Prototype → Benchmark → Profiling → Gain → Cost → Decision
```

Fill in and keep [`docs/hypothesis.md`](docs/hypothesis.md) up to date at every step of the investigation.

## Module layout
- `docs/hypothesis.md` — scoping sheet, experimental protocol, metrics and final verdict.
- `implementation/referenceEngine.ts` — reference implementation or scene (current engine, without the technique).
- `implementation/` — experimental prototype of the new architecture / pass.
- `runner/` — automated test scripts and reproducible load scenarios.
- `results/` — capture traces, measured metrics, charts and visual comparisons.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
