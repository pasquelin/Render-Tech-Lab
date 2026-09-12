# 02-gpu-frustum-culling — GPU Frustum Culling Compute WGSL

## 1. Question Gouvernante
> *Quel gain apporte l'externalisation du test d'intersection plan/sphère sur Compute Shader WGSL par rapport à la boucle CPU récursive Three.js ?*

---

## 2. Statut & Décision R&D
- **Implémentation :** oracle CPU et shader WGSL présents ; harness physique partagé disponible.
- **Décision contractuelle :** `not-yet-decided`.
- **Résultat :** aucun chiffre historique n'est retenu sans nouvelle campagne matérielle traçable.

---

## 3. Architecture Technique
```text
ObjectBuffer (Instances VRAM)
       │
       ▼
Compute Shader WGSL (Test plans de frustum / sphère englobante)
       │
       ├── Hors frustum ──► Rejet (0 écriture)
       │
       └── Dans frustum ──► atomicAdd(drawIndirect.instanceCount, 1)
                               │
                               ▼
                    drawIndexedIndirect (1 draw call)
```

---

## 4. Composants
- `implementation/` : Shader WGSL de culling et binding WebGPU.
- `runner/` : Profilage comparatif avec CPU frustum culling Three.js.
- `results/` : Métriques brutes standardisées `latest.json` et rapport `REPORT.md`.

## 5. Exécution actuelle et branchement dans la coque

- `runCullingSuite()` est l'oracle CPU déterministe : il vérifie les sphères intérieures, extérieures et sécantes ainsi que la présence du contrat WGSL. Il termine immédiatement et ne publie aucune performance.
- Le banc physique existe dans `bench/main.ts` et expose `window.renderTechLabBench.run({ test: '02-gpu-frustum-culling', ... })`. Il mesure les variantes avec une matrice finie, un warmup et un nombre d'échantillons bornés.
- L'interface React ouvre aujourd'hui ce harness autonome dans un nouvel onglet. Pour rester dans la coque, le code commun doit extraire ce moteur en runner importable recevant le canvas déjà monté, des callbacks `onProgress`/`onMetrics`, un `AbortSignal`, puis retourner le rapport sans navigation.
- La coque doit garder un seul propriétaire de rendu : suspendre l'aperçu pendant la campagne, exécuter les variantes successivement, puis restituer le canvas à l'aperçu après terminaison ou annulation.

Le module local ne peut pas réaliser seul ce dernier branchement sans modifier la coque et le harness commun.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
