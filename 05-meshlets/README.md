# 05-meshlets — Partitionnement en Clusters (Meshlets)

## 1. Question Gouvernante
> *Quelle granulométrie de sous-maillage (cluster) offre le meilleur équilibre entre granularité de culling et explosion des métadonnées ?*

---

## 2. Statut & Décision R&D
- **Statut :** Oracle CPU exécutable et invariants de partitionnement validés. Campagne GPU non intégrée à la coque commune.
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Paliers testés : 64, 128, 256, 512 triangles par meshlet.

---

## 4. Structure du Banc
- `implementation/` : partitionneur CPU et calcul de ses métadonnées. Aucun shader ni timing GPU n'est validé dans ce banc.
- `runner/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.

Le test local `node --experimental-strip-types 05-meshlets/tests/test_meshlets.ts`
vérifie les quatre tailles, la couverture exacte, les limites, les bounds et les entrées invalides.
Ses durées sont diagnostiques et ne constituent pas une campagne physique publiée.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
