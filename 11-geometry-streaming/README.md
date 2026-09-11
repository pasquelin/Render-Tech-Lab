# 11-geometry-streaming — Résidence VRAM & Cycle de Pression Mémoire

## 1. Question Gouvernante
> *Comment garantir un chargement asynchrone par morceaux sous contrainte stricte de budget VRAM sans saccade ?*

---

## 2. Statut & Décision R&D
- **Statut :** Prévu (Spécifié dans `MASTER_TEST_PLAN.md`)
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Cycle de vie : Cold → Loading → Partially Resident → Fully Resident → Eviction → Re-request.

---

## 4. Structure du Banc
- `baseline/` : Référence ou étalon comparatif.
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `benchmark/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.
