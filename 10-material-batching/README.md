# 10-material-batching — Matérialisation & Indexation Dynamique

## 1. Question Gouvernante
> *Quelle stratégie de matérialisation minimise réellement le coût CPU / GPU / mémoire dans l'environnement WebGPU ?*

---

## 2. Statut & Décision R&D
- **Statut :** Prévu (Spécifié dans `MASTER_TEST_PLAN.md`)
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Variantes : state switch classique, Material Storage Buffer, Texture Arrays, Dynamic Indexing.

---

## 4. Structure du Banc
- `baseline/` : Référence ou étalon comparatif.
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `benchmark/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.
