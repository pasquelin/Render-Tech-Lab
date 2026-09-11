# 08-occlusion-culling — Implementation

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté.

## 1. Chaine de calcul (planifiée)

```text
[05] meshlets ──► [06] culling (frustum / cône / sub-pixel) ──► [07] Hi-Z
                                                              │
                                                              ▼
                                                     [08] occlusion test
                                                              │
                                                              ▼
                                                     visible[] + gainNet
```

## 2. Métriques obligatoires (Master Test Plan §7-08)

- `objectsTotal`, `objectsVisible`, `objectsOccluded`
- `trianglesRejected`, `meshletsRejected`
- `hiZGenerationMs` (banc 07)
- `cullingMs` (banc 08)
- `gainNet` = `baseline − (HiZ + culling + raster)`

## 3. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | `gainNet > 0` et stable entre paliers |
| `REJECT`    | `gainNet <= 0` sur > 50 % des paliers |
| `WATCHLIST` | Gain positif seulement aux paliers élevés (75 %+) |

## 4. Non-fait volontairement

- Hi-Z dynamique — la pyramide est pleine.
- Occlusion par pixel — l'échelle est le meshlet.
- Combinaison avec le banc 09 (compaction) — le banc 09 est indépendant.
