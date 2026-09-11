# 13-full-gpu-driven — Implementation

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté. Ce banc dépend de la complétude des bancs 03→12 ; tant qu'un d'entre eux n'est pas `INTEGRATE`, ce banc reste `not-run`.

## 1. Périmètre

- Assemblage de la chaîne contractuelle (ordre fixe, pas de reconfiguration) :

```text
gpu-scene → frustum → lod → meshlets → meshlet-culling
        → hiz → occlusion → compaction → indirect-draw → shading
```

- Références croisées : 00-baseline (S3, S5), 03-gpu-scene, 01-indirect-draw.

## 2. Architecture prévue (NON IMPLÉMENTÉE)

```text
[13] FullPipelineRunner
        ├─► stage 01  gpu-scene         (banc 03)
        ├─► stage 02  frustum           (banc 02)
        ├─► stage 03  lod               (banc 04)
        ├─► stage 04  meshlets          (banc 05)
        ├─► stage 05  meshlet-culling   (banc 06)
        ├─► stage 06  hiz               (banc 07)
        ├─► stage 07  occlusion         (banc 08)
        ├─► stage 08  compaction        (banc 09)
        ├─► stage 09  indirect-draw     (banc 01)
        └─► stage 10  shading           (banc 10 + 12)
```

Aucune optimisation n'est introduite ici : le banc 13 **mesure** la somme des stages et le compare à 00-baseline.

## 3. Métriques consolidées (voir `13-full-gpu-driven/types.ts`)

- `stages[i].durationMs` : durée de chaque stage (mesurée par son banc source, aucun chiffre pré-rempli).
- `stages[i].inputCount / outputCount` : entrées/sorties de chaque stage.
- `baselineReference` : référence `00-baseline` S3/S5 (submit, frame) — valeur contractuelle du 00.
- `totalGainMs` : gain net `baseline − pipeline` (calculé à partir de mesures réelles, non pré-rempli).
- `verdict` : arbitrage global.

## 4. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | `totalGainMs > 0` ET chaque stage `INTEGRATE` (ou `WATCHLIST` accepté) |
| `REJECT`    | `totalGainMs <= 0` sur plus d'un palier |
| `WATCHLIST` | Gain net positif seulement à `P-50k` — utile mais coûteux |

## 5. Non-fait volontairement

- Optimisation temporelle / reprojection — phase 2 uniquement.
- Hiérarchisation des meshlets (BVH GPU) — phase 2 uniquement.
- Streaming de géométrie dans la chaîne : la scène est supposée résidente (banc 11).

## 6. Dépendances d'exécution

Ce banc ne peut produire aucun chiffre validé tant que :
- `03-gpu-scene` a un verdict `INTEGRATE`
- `01-indirect-draw` a un verdict `INTEGRATE`
- Les bancs 05→12 ont chacun un verdict (peut être `WATCHLIST` ou `REJECT`)

Tant que cette condition n'est pas remplie, `13-full-gpu-driven/results/latest.json` reste `status: "not-run"`.
