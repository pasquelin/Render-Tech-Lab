# 06-meshlet-culling — Implementation

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté. Ce document est une carte d'intention, pas un état livré.

## 1. Périmètre

- Consomme les types `Meshlet` de `05-meshlets/contracts.ts` (contrat partagé).
- 3 tests de rejet strict, indépendants et instrumentés :
  - **Frustum** : test plan/sphère
  - **Backface / cône de normale** : test du sommet et de la demi-ouverture
  - **Sub-pixel** : taille projetée < 1 pixel

## 2. Architecture prévue (NON IMPLÉMENTÉE)

```text
[05] meshlets (clusters)  ──►  [06] compute WGSL
                                    ├─► plane-sphere test
                                    ├─► cone test
                                    └─► sub-pixel test
                                             │
                                             ▼
                                    visible[]  +  rejectCounts{frustum,backface,subpixel}
```

## 3. Métriques obligatoires (Master Test Plan §7-06)

| Métrique | Définition |
|---|---|
| `totalMeshlets` | Nombre soumis |
| `visibleMeshlets` | Nombre retenu |
| `rejectedMeshlets` | Nombre rejeté |
| `rejectRate` | `rejected / total` |
| `frustumRejectRate` | Rejeté pour cause de frustum |
| `backfaceRejectRate` | Rejeté pour cause de cône |
| `subpixelRejectRate` | Rejeté pour cause de sub-pixel |

## 4. Paliers de charge

| Palier | Description |
|---|---|
| Frustum | 5 000 meshlets, sphère englobante partiellement à l'extérieur du frustum |
| Backface | 5 000 meshlets, normales tournées vers l'arrière |
| Sub-pixel | 5 000 meshlets, taille projetée < 1 pixel |
| Mixed | 5 000 meshlets, 30 % de chaque cause |

## 5. Non-fait volontairement

- Optimisation propriétaire (reprojection temporelle, BVH GPU) — phase 2 uniquement.
- Hi-Z — c'est le banc 07.
- Ordre d'évaluation : aucun choix imposé ; le banc doit simplement produire les 4 métriques.

## 6. Livrables attendus avant exécution

| Livrable | État |
|---|---|
| `06-meshlet-culling/contracts.ts` | ✅ Présent |
| `06-meshlet-culling/benchmark.md` | ✅ Présent |
| `06-meshlet-culling/baseline/noCulling.ts` | ❌ À créer |
| `06-meshlet-culling/implementation/cullingShader.ts` | ❌ À créer |
| `06-meshlet-culling/results/latest.json` | ✅ Squelette `not-run` |
