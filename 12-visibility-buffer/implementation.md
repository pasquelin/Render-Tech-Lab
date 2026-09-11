# 12-visibility-buffer — Implementation

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté.

## 1. Périmètre

- Deux passes strictes :
  - **Pass 1** : écriture compacte d'IDs (primitive / matériau) + profondeur
  - **Pass 2** : shading différé unique aux pixels visibles

## 2. Architecture prévue (NON IMPLÉMENTÉE)

```text
Pass 1 : primitives → write primitiveId + materialId + depth
        │
        ▼
Pass 2 : read IDs per pixel → resolve material → shade
```

## 3. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | `shadingCostMs + overhead < forwardCost` et `overdrawAvoided > 30 %` |
| `REJECT`    | `shadingCostMs > forwardCost` sur 2 des 4 paliers |
| `WATCHLIST` | Net positif seulement aux paliers élevés (V-10k+) |

## 4. Non-fait volontairement

- G-buffer complet : seuls les IDs + depth sont écrits (pass 1).
- Hybrid (no mixing) : la comparaison est stricte, pas de mix.
- Multi-sample : non couvert.
