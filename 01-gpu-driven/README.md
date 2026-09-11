# 01-gpu-driven — GPU-Driven Rendering Pipeline

## Description
Architecture de rendu pilotée par le GPU pour Three.js / WebGPU. L'objectif fondamental est d'éliminer le goulot d'étranglement de soumission CPU (`submitMs` / boucle séquentielle de draw calls) en transférant l'évaluation de visibilité (culling), le choix de niveau de détail (LOD) et l'émission des commandes de rendu directement sur le GPU via compute shaders et `drawIndexedIndirect`.

> **Principe invariant : Zéro retour de visibilité vers le CPU.**  
> Aucun `mapAsync(READ)` ni lecture bloquante de compteurs de visibilité n'est toléré dans la boucle de frame.

---

## Les 5 Phases d'Évolution du Laboratoire

```
Phase 1 : Suppression du CPU Submit (Frustum culling GPU + Indirect Buffer)
   │
   ▼
Phase 2 : Descente d'Abstraction (Niveau A TSL → Niveau B Common Backend → Niveau C Fork)
   │
   ▼
Phase 3 : Sélection LOD GPU (Métrique Screen-Space Error sans round-trip)
   │
   ▼
Phase 4 : Partitionnement en Meshlets & Cluster Culling (Approche Nanite)
   │
   ▼
Phase 5 : Hi-Z Occlusion Culling (Pyramide de profondeur + indirect compaction)
```

---

## Matrice des 4 Bancs d'Essai Comparatifs (Scène étalon : 2 000 objets)

| Banc | Nom | Culling & LOD | Soumission | Mesure clé |
|:---:|---|---|---|---|
| **Test A** | **Three.js Classique** | CPU Frustum culling objet par objet | 2 000 `drawIndexed` séquentiels via `WebGPURenderer` | Baseline de référence CPU submit |
| **Test B** | **GPU Culling** | Compute Pass GPU Frustum + compactage atomique | 1 appel `drawIndexedIndirect` | Effondrement de `submitMs` |
| **Test C** | **GPU Culling + LOD** | GPU Frustum + Screen-space error metric (LOD0..LOD3) | `drawIndexedIndirect` multi-LOD | Réduction géométrie sans surcoût CPU |
| **Test D** | **GPU Culling + LOD + Hi-Z** | GPU Frustum + Hi-Z occlusion + LOD | `drawIndexedIndirect` compacté | Rejet précoce des objets masqués |

---

## Recherche du Point de Croisement (*Crossover Point*)

Le banc teste automatiquement 4 paliers de complexité :
- **500 objets**
- **1 000 objets**
- **2 000 objets** (Stress soumission CPU — Spec 13 / Scénario S3)
- **5 000 objets**

L'objectif est d'identifier la courbe de charge et le seuil exact où l'overhead de dispatch compute GPU devient inférieur au coût d'encodage de commandes CPU de Three.js.

```text
CPU submit (ms)
  ▲
3 │                     ╱ (Three.js classique - O(N))
  │                   ╱
2 │                 ╱
  │   ────────────╱───────── (GPU-driven - O(1) CPU)
1 │             ╱
  │           ╱
0 ┼─────────▲───────────────► Nombre d'objets
  0        1k      2k      5k
           └─ Crossover Point
```

---

## Structure du Dossier
- [`hypothesis.md`](hypothesis.md) : Protocole d'arbitrage R&D, critères de décision et seuils de bascule.
- `baseline/` : Scène et moteur de rendu Test A (Three.js standard).
- `implementation/` : Mini-renderer expérimental Test B (StorageBuffers plats, compute shader, indirect draw).
- `benchmark/` : Harnais de mesure automatisé, instrumentation haute précision et profilage.
- `results/` : Données collectées (JSON), courbes de crossover et traces WebGPU.
