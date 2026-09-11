# 11-geometry-streaming — Benchmark

**Question gouvernante :** Comment garantir un chargement asynchrone par morceaux sous contrainte stricte de budget VRAM sans saccade (*frame stutter*) ?

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté. Aucune valeur n'est mesurée.

## 1. Cycle de vie (contractuel, Master Test Plan §7-11)

```text
  Cold  ──►  Loading  ──►  Partially Resident  ──►  Fully Resident  ──►  Eviction  ──►  Re-request
```

Chaque transition est instrumentée et mesurée séparément.

## 2. Paliers (fraction de géométrie demandée)

| Palier | Fraction demandée |
|---|---|
| G-10  | 10 % |
| G-25  | 25 % |
| G-50  | 50 % |
| G-100 | 100 % |

## 3. Métriques obligatoires (Master Test Plan §7-11)

| Métrique | Définition |
|---|---|
| `residentBytes` | Mémoire résidente (octets) |
| `uploadedBytes` | Volume chargé cette trame (octets) |
| `evictedBytes` | Volume évincé cette trame (octets) |
| `uploadTimeMs` | Temps de upload (ms) |
| `frameTimeMs` | Temps de frame (ms) |
| `stalls` | Nombre de frames bloquées sur l'upload |

## 4. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | `stalls == 0` sur les 4 paliers et `frameTimeMs < budget` contractuel |
| `REJECT` | `stalls > N/10` sur n'importe quel palier (saccade persistante) |
| `WATCHLIST` | Gain net démontré seulement à G-10 (fraction faible) — technique utile mais sensible à la charge |

## 5. Non-fait volontairement

- Streaming multi-GPU / partitionnement.
- Évacuation LRU vs. LRU + pré-fetch : le banc choisit une politique, pas les tester toutes.
- Streaming de textures : non couvert (watchlist README).
