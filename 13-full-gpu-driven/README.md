# 13-full-gpu-driven — Pipeline Complet Unifié & Bilan Systémique

## 1. Question Gouvernante
> *La chaîne complète assemblée produit-elle un gain net supérieur à la somme des complexités et des surcoûts introduits ?*

---

## 2. Statut & Décision R&D
- **Statut :** Prévu (Spécifié dans `MASTER_TEST_PLAN.md`)
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Bilan global comparatif contre 00-baseline et chaque prototype unitaire intermédiaire.

---

## 4. Structure du Banc
- `baseline/` : Référence ou étalon comparatif.
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `benchmark/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.
