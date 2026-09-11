# 12-visibility-buffer — Architecture de Visibilité & Shading Différé

## 1. Question Gouvernante
> *Le découplage strict entre calcul de visibilité et shading différé apporte-t-il un gain net sur WebGPU face aux scènes denses ?*

---

## 2. Statut & Décision R&D
- **Statut :** Prévu (Spécifié dans `MASTER_TEST_PLAN.md`)
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Passes : Passe 1 (visibilité 32-bit compacte), Passe 2 (reconstruction et shading différé).

---

## 4. Structure du Banc
- `baseline/` : Référence ou étalon comparatif.
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `benchmark/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.
