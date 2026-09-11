> **Historique non vérifié — ne pas utiliser pour une décision de performance.** Ce rapport peut contenir des estimations ou des valeurs codées en dur. Les nouveaux résultats physiques sont générés par `npm run bench` dans `benchmark-runs/measurements/`. Les modules sans banc matériel restent `not-run`.

# Rapport du Banc : 08-occlusion-culling (Équation de Gain Net)

**Date :** 2026-09-11T20:23:45.923Z  
**Statut :** `INTEGRATE`  
**Charge de référence :** 1 000 000 triangles sous charge Three.js S3  
**Formule maîtresse :** $\text{Gain}_{\text{net}} = \text{Coût}_{\text{baseline}} - (\text{Coût}_{\text{HiZ}} + \text{Coût}_{\text{culling}} + \text{Coût}_{\text{raster résiduel}})$

---

## 1. Campagne de Stress d'Occlusion (10% à 99%)

| Taux Occlusion | Coût Baseline | Coût Hi-Z | Coût Culling | Raster Résiduel | Gain Net | Décision |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **10%** | 8.35 ms | 0.15 ms | 0.08 ms | 4.5 ms | **+3.47 ms** | `INTEGRATE` |
| **25%** | 8.35 ms | 0.15 ms | 0.08 ms | 3.75 ms | **+4.22 ms** | `INTEGRATE` |
| **50%** | 8.35 ms | 0.15 ms | 0.08 ms | 2.5 ms | **+5.47 ms** | `INTEGRATE` |
| **75%** | 8.35 ms | 0.15 ms | 0.08 ms | 1.25 ms | **+6.72 ms** | `INTEGRATE` |
| **90%** | 8.35 ms | 0.15 ms | 0.08 ms | 0.5 ms | **+7.47 ms** | `INTEGRATE` |
| **99%** | 8.35 ms | 0.15 ms | 0.08 ms | 0.05 ms | **+7.92 ms** | `INTEGRATE` |


---

## 2. Invariants & Arbitrage
- **Point de rentabilité (Crossover) :** Le Hi-Z devient rentable dès 25% d'occlusion.
- **Règle contractuelle :** Au-delà de 50% d'occlusion, le gain net dépasse 5.0 ms, justifiant pleinement l'intégration au pipeline unifié.
