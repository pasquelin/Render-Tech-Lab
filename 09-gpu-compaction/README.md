# 09-gpu-compaction — Compaction Multi-Échelles & Contention

## 1. Question Gouvernante
> *Quelle méthode de compaction de liste visible résiste le mieux à l'explosion de charge et à la concurrence des threads ?*

---

## 2. Statut & Décision R&D
- **Statut :** oracle CPU local et harness WebGPU partagé présents ; intégration dans la coque et campagne physique à finaliser.
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Variantes : sans compaction (1 thread), atomicAdd global, parallel scan par workgroup.

---

## 4. Structure du Banc
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `runner/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.

## 5. Exécution actuelle et branchement dans la coque

- `runCompactionSuite()` termine sur une matrice déterministe de 12 cas et compare les sorties des trois oracles CPU. Ses durées sont étiquetées CPU et ne constituent pas des résultats GPU.
- Le banc physique est actuellement fourni par `bench/main.ts` avec `window.renderTechLabBench.run({ test: '09-gpu-compaction', pattern, ... })`; ses variantes WebGPU résident dans `shared/benchmark/compaction.ts`.
- L'interface React ouvre ce harness autonome dans un nouvel onglet. L'intégration correcte demande un runner commun importable, alimenté par le canvas de la coque, avec progression, métriques, terminaison, annulation et restitution explicite de la propriété du canvas.
- La correctness gate intégrée doit relire les indices hors zone chronométrée et comparer chaque variante GPU à l'oracle local avant d'autoriser un rapport `measured`.

Ce branchement traverse `bench/` et la coque React ; il est donc documenté ici mais ne peut pas être appliqué depuis le seul périmètre du banc 09.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
