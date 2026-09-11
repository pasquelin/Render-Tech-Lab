# 11-geometry-streaming — Implementation

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté.

## 1. Périmètre

- Cycle de vie de résidence VRAM (contractuel) :
  `cold → loading → partially-resident → fully-resident → eviction → re-request`

## 2. Architecture prévue (NON IMPLÉMENTÉE)

```text
requestedFraction (10/25/50/100 %)
        │
        ▼
[11] streaming pipeline
        ├─► uploader asynchrone (chunked)
        ├─► eviction policy (LRU par défaut, non imposé)
        └─► instrumentation par transition du cycle
```

## 3. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | `stalls == 0` sur les 4 paliers et `frameTimeMs < budget` |
| `REJECT`    | `stalls > N/10` sur n'importe quel palier |
| `WATCHLIST` | Gain net seulement au palier G-10 (fraction faible) |

## 4. Non-fait volontairement

- Streaming multi-GPU / partitionnement.
- Streaming de textures : watchlist (README).
