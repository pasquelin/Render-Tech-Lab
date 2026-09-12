# Moteurs comparés — banc 15

La matrice vit dans `@web-geometry/sdk` (`COMPARISON_LIBRARIES`) et le registre du banc (`implementation/engines.ts`). Aucune bibliothèque absente n’est simulée.

| Id | Statut | Notes |
|---|---|---|
| `three-webgl-reference` | intégrée | Three.js WebGL2, frustum standard, pas de géométrie virtualisée |
| `exact-cluster-pages` | intégrée | Clusters, hiérarchie, culling CPU, pages, résidence |
| `three-lod` | intégrée | `THREE.LOD`, distances dérivées du rayon ; pas les mêmes unités que `pixelError` |
| `webgpu-page-raster` | compatible, PBR absent | Raster de pages WebGPU (`createGpuPageCache`) ; exclu du verdict texturé |
| `meshoptimizer` | non comparable | Bibliothèque de compilation, pas un renderer |
| `3d-tiles-renderer` / CesiumJS | non comparable | Format 3D Tiles, pas le glTF Emerald |
| `babylon-lod` / PlayCanvas | non comparable | Autre moteur, autres matériaux |
| `nanite-webgpu` | incompatible | Démo applicative, autre préprocesseur |
| `three-nanite-example` | non comparable | Exemple Three.js WebGPU, pas une API paquet |
| VCG Nexus | abandonnée / GPL | Format `.nxs` distinct |

Ajouter un moteur : implémenter `BackendFactory` dans le SDK, l’enregistrer dans `BENCH_ENGINES`. Le shell React et le protocole ne changent pas.