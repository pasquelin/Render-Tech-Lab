# 13-full-gpu-driven — Benchmark

**Question gouvernante :** La chaîne complète assemblée produit-elle un gain net supérieur à la somme des complexités et des surcoûts introduits ?

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté. Ce banc dépend de la complétude des bancs 03→12 ; tant que l'un d'eux n'est pas `INTEGRATE`, ce banc reste `not-run`.

## 1. Assemblage (ordre contractuel)

```text
GPU Scene   (banc 03 — hétérogène, multi-topologies)
   │
   ▼
Frustum     (banc 02 — culling plan/sphère)
   │
   ▼
LOD         (banc 04 — sélection Screen-Space Error)
   │
   ▼
Meshlets    (banc 05 — partitionnement en clusters)
   │
   ▼
Meshlet Culling  (banc 06 — frustum / cône / sub-pixel)
   │
   ▼
Hi-Z        (banc 07 — pyramide de profondeur)
   │
   ▼
Occlusion   (banc 08 — culling par pyramide)
   │
   ▼
Compaction  (banc 09 — liste visible compactée)
   │
   ▼
Indirect Draw  (banc 01 — drawIndexedIndirect, 1 draw call)
   │
   ▼
Shading   (banc 10 + 12 — matériaux + visibilité)
```

L'ordre ci-dessus est **contractuel** : le banc 13 ne change pas l'ordre, il le mesure.

## 2. Paliers

Ce banc applique la même `SceneConfig` (graine canonique `DEFAULT_SEED` de `shared/scene/`) sur les paliers :

| Palier | Objets | Matériaux | Géométries |
|---|---|---|---|
| P-2k   | 2 000  | 10  | 10 |
| P-10k  | 10 000 | 50  | 50 |
| P-50k  | 50 000 | 100 | 100 |

## 3. Métriques obligatoires (Master Test Plan §7-13)

| Métrique | Définition |
|---|---|
| `stages[i].durationMs` | Durée de chaque stage (mesurée par son banc source) |
| `stages[i].inputCount` / `stages[i].outputCount` | Entrées/sorties de chaque stage |
| `baselineReference` | Référence `00-baseline` S3/S5 (soumission CPU, frame CPU) |
| `totalGainMs` | Gain net global (baseline − pipeline) |
| `verdict` | Arbitrage global |

## 4. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | `totalGainMs > 0` et chaque stage `INTEGRATE` (ou `WATCHLIST` accepté) |
| `REJECT`    | `totalGainMs <= 0` sur plus d'un palier |
| `WATCHLIST` | Gain net positif seulement à `P-50k` — utile mais coûteux |

## 5. Non-fait volontairement

- Optimisation temporelle / reprojection — phase 2 uniquement.
- Hiérarchisation des meshlets (BVH GPU) — phase 2 uniquement.
- Streaming de géométrie dans la chaîne : la scène est supposée résidente (banc 11).
