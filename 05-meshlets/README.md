# 05-meshlets — Partitionnement en Clusters (Meshlets)

## 1. Question Gouvernante
> *Quelle granulométrie de sous-maillage (cluster) offre le meilleur équilibre entre granularité de culling et explosion des métadonnées ?*

---

## 2. Statut & Décision R&D
- **Statut :** Prévu (Spécifié dans `MASTER_TEST_PLAN.md`)
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Paliers testés : 64, 128, 256, 512 triangles par meshlet.

---

## 4. Structure du Banc
- `baseline/` : Référence ou étalon comparatif.
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `benchmark/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.
