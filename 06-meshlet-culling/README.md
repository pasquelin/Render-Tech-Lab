# 06-meshlet-culling — Cluster Culling & Taux de Rejet

## 1. Question Gouvernante
> *Quel volume géométrique précis est éliminé avant rasterisation par cluster culling, et quelle part revient à chaque test ?*

---

## 2. Statut & Décision R&D
- **Statut :** Prévu (Spécifié dans `MASTER_TEST_PLAN.md`)
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Métriques de rejet : global, frustum, backface cône, sub-pixel.

---

## 4. Structure du Banc
- `baseline/` : Référence ou étalon comparatif.
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `benchmark/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.
