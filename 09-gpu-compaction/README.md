# 09-gpu-compaction — Compaction Multi-Échelles & Contention

## 1. Question Gouvernante
> *Quelle méthode de compaction de liste visible résiste le mieux à l'explosion de charge et à la concurrence des threads ?*

---

## 2. Statut & Décision R&D
- **Statut :** Prévu (Spécifié dans `MASTER_TEST_PLAN.md`)
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Variantes : sans compaction (1 thread), atomicAdd global, parallel scan par workgroup.

---

## 4. Structure du Banc
- `baseline/` : Référence ou étalon comparatif.
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `benchmark/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.
