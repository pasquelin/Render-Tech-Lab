# Moteurs comparés — banc 15

La matrice vit dans `@web-geometry/sdk` (`COMPARISON_LIBRARIES`) et le registre du banc (`implementation/engines.ts`). Aucune bibliothèque absente n’est simulée.

| Id | Statut | Notes |
|---|---|---|
| `three-webgl-reference` | intégrée | THREE.js basic : Three.js WebGL2, frustum standard, pas de géométrie virtualisée |
| `three-lod` | intégrée | THREE.js LOD : niveaux de détail classiques, géométrie résidente |
| `exact-cluster-pages` | intégrée | WebGeometry WebGL : clusters, hiérarchie, culling CPU, pages, résidence |
| `webgpu-page-raster` | compatible, PBR absent | WebGeometry WebGPU : raster WebGPU (compute, visbuffer, Hi-Z), hors verdict visuel A/A |
| `meshoptimizer` | non comparable | Bibliothèque de compilation, pas un renderer |
| `3d-tiles-renderer` / CesiumJS | non comparable | Format 3D Tiles, pas le glTF Model |
| `babylon-lod` / PlayCanvas | non comparable | Autre moteur, autres matériaux |
| VCG Nexus | abandonnée / GPL | Format `.nxs` distinct |

Ajouter un moteur : implémenter `BackendFactory` dans le SDK, l’enregistrer dans `BENCH_ENGINES`. Le shell React et le protocole ne changent pas.
