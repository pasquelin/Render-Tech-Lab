# 08-occlusion-culling — Occlusion Culling & Équation de Gain Net

## 1. Question Gouvernante
> *À partir de quel seuil d'occlusion le culling Hi-Z compense-t-il son propre surcoût de génération et de test ?*

---

## 2. Statut & Décision R&D
- **Statut :** Prévu (Spécifié dans `MASTER_TEST_PLAN.md`)
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Scénarios d'occlusion : 10%, 25%, 50%, 75%, 90%, 99%.

---

## 4. Structure du Banc
- `baseline/` : Référence ou étalon comparatif.
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `benchmark/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.
