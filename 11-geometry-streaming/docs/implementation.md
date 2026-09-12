# 11-geometry-streaming — Implementation

**Statut :** noyau contractuel implémenté dans `implementation/streamingLifecycle.ts`. L'ancien simulateur reste conservé pour compatibilité ; l'intégration commune doit importer le nouveau module.

## 1. Périmètre

- Cycle de vie de résidence VRAM (contractuel) :
  `cold → loading → partially-resident → fully-resident → eviction → re-request`

## 2. Architecture implémentée

```text
requestedFraction (10/25/50/100 %)
        │
        ▼
[11] streaming pipeline
        ├─► uploader asynchrone (chunked)
        ├─► eviction policy (LRU par défaut, non imposé)
        └─► instrumentation par transition du cycle
```

La publication vérifie la génération de la requête. La résolution conserve une couverture complète via les pages de repli. Le budget porte sur les payloads connus du gestionnaire, sans prétendre être un compteur RAM ou VRAM du système.

## 3. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | `stalls == 0` sur les 4 paliers et `frameTimeMs < budget` |
| `REJECT`    | `stalls > N/10` sur n'importe quel palier |
| `WATCHLIST` | Gain net seulement au palier G-10 (fraction faible) |

## 4. Non-fait volontairement

- Streaming multi-GPU / partitionnement.
- Streaming de textures : watchlist (README).
