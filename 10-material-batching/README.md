# 10-material-batching — Matérialisation & Indexation Dynamique

## 1. Question Gouvernante
> *Quelle stratégie de matérialisation minimise réellement le coût CPU / GPU / mémoire dans l'environnement WebGPU ?*

---

## 2. Statut & Décision R&D
- **Statut :** noyau exécutable et contrôles déterministes disponibles ; adaptateur WebGPU à brancher dans le runner navigateur commun
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Variantes : state switch classique, Material Storage Buffer, Texture Arrays, Dynamic Indexing.

---

## 4. Structure du Banc
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `runner/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.

## 5. Ce que le banc exécute

`implementation/materialBatcher.ts` construit le même ordre de draws pour les quatre stratégies, compte les vraies transitions de cet ordre et orchestre une matrice bornée avec warmup, échantillons, progression et annulation. Le callback de mesure doit exécuter le rendu matériel et renvoyer une empreinte de lecture de sortie : une campagne est refusée si une stratégie ne produit pas la même sortie que la référence.

Le noyau ne transforme jamais un compteur de changements d'état en durée. `cpuFrameMs` et `gpuFrameMs` restent `null` tant que l'adaptateur physique ne les a pas mesurés.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
