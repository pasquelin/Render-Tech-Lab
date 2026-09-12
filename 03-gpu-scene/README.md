# 03 · Scène GPU plate — hétérogénéité, buffers et mises à jour dynamiques

Représentation d'une scène complète sur GPU pour surmonter la barrière de l'hétérogénéité (multi-géométries, multi-matériaux, transformations dynamiques).

**Ce qui tourne réellement :** une baseline Three.js et un renderer WebGPU sur les mêmes scènes générées avec une graine fixe. Ce banc mesure la représentation plate et son culling par géométrie ; il n'assemble pas les meshlets, Hi-Z, streaming ou visibility buffer.

**Terminaison et justesse :** les campagnes parcourent une matrice finie et libèrent la génération de buffers entre scénarios. Le test local contrôle les offsets, l'alignement 96 octets, les topologies, le caractère déterministe et la structure indirecte avant toute mesure physique.

## Organisation du module

- **`docs/hypothesis.md`** : Cadrage théorique, seuils de décision et définition des 4 dimensions de test.
- **`contracts.ts`** : Interfaces TypeScript et layouts mémoire alignés WGSL (`GPUObjectData`, `GPUGeometryData`, `GPUMaterialData`, `DrawIndexedIndirectCommand`).
- **`implementation/classicMultiMeshScene.ts`** : Scène Three.js équivalente gérant $N$ géométries et $M$ matériaux avec son graphe de scène standard.
- **`implementation/`** : Architecture GPU-driven multi-tampons (`gpuSceneBuffers.ts`, `gpuSceneCulling.wgsl`, `gpuSceneRenderer.ts`).
- **`runner/`** : Générateur de tests multi-axes (A: géométrie, B: matériaux, C: dynamique, D: visibilité) et exécuteur de mesures.
- **`results/REPORT.md`** : Rapport d'arbitrage consolidé et résultats chiffrés.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
