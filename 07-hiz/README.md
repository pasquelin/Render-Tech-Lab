# 07-hiz — Hi-Z Occlusion Depth Pyramid

## 1. Question Gouvernante
> *Quel est le coût matériel net (en ms GPU et bande passante VRAM) de la construction hiérarchique d'un tampon de profondeur sous WebGPU ?*

---

## 2. Statut & Décision R&D
- **Statut :** Prévu (Spécifié dans `MASTER_TEST_PLAN.md`)
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Résolutions testées : 512², 1024², 2048².

---

## 4. Structure du Banc
- `baseline/` : Référence ou étalon comparatif.
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `benchmark/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.
