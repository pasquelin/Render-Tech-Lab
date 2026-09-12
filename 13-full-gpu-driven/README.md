# 13-full-gpu-driven — Pipeline Complet Unifié & Bilan Systémique

## 1. Question Gouvernante
> *La chaîne complète assemblée produit-elle un gain net supérieur à la somme des complexités et des surcoûts introduits ?*

---

## 2. Statut & Décision R&D
- **Statut :** orchestrateur de préparation exécutable ; pipeline physique bloqué tant que 01→12 ne sont pas mesurés et arbitrés.
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Bilan global comparatif contre 00-baseline et chaque prototype unitaire intermédiaire.

---

## 4. Structure du Banc
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `runner/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.

L'orchestrateur retourne la liste exacte des dépendances absentes, non mesurées, non décidées ou rejetées. Quand toutes les gates passent, il refuse encore explicitement de publier un résultat tant que les stages physiques ne sont pas branchés : un rapport vide ne peut donc plus être confondu avec une exécution réussie.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
