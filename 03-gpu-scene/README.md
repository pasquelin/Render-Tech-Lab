# Module 02 : GPU Scene & Scène Hétérogène

Représentation d'une scène complète sur GPU pour surmonter la barrière de l'hétérogénéité (multi-géométries, multi-matériaux, transformations dynamiques).

## Organisation du module

- **`hypothesis.md`** : Cadrage théorique, seuils de décision et définition des 4 dimensions de test.
- **`types.ts`** : Interfaces TypeScript et layouts mémoire alignés WGSL (`GPUObjectData`, `GPUGeometryData`, `GPUMaterialData`, `DrawIndexedIndirectCommand`).
- **`baseline/`** : Scène Three.js équivalente gérant $N$ géométries et $M$ matériaux avec son graphe de scène standard.
- **`implementation/`** : Architecture GPU-driven multi-tampons (`gpuSceneBuffers.ts`, `gpuSceneCulling.wgsl`, `gpuSceneRenderer.ts`).
- **`benchmark/`** : Générateur de tests multi-axes (A: géométrie, B: matériaux, C: dynamique, D: visibilité) et exécuteur de mesures.
- **`results/REPORT.md`** : Rapport d'arbitrage consolidé et résultats chiffrés.
