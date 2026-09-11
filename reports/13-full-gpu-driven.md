# Rapport du Banc : 13-full-gpu-driven (Architecture Complète Unifiée)

**Date :** 2026-09-11T19:56:56.615Z  
**Statut :** `INTEGRATE`  
**Scène de stress :** 100,000 instances ($38{,}400{,}000$ triangles)

---

## 1. Trace Complète des 10 Étages du Pipeline

| Étage de Rendu | Entrées | Sorties | Durée Estimée GPU/CPU | Verdict Étage |
|---|:---:|:---:|:---:|:---:|
| `gpu-scene` | 100,000 | 100,000 | 0.15 ms | `INTEGRATE` |
| `frustum` | 100,000 | 60,000 | 0.08 ms | `INTEGRATE` |
| `lod` | 60,000 | 60,000 | 0.05 ms | `INTEGRATE` |
| `meshlets` | 10,380,000 | 81,094 | 0.22 ms | `INTEGRATE` |
| `meshlet-culling` | 81,094 | 40,547 | 0.12 ms | `INTEGRATE` |
| `hiz` | 2,073,600 | 11 | 0.18 ms | `INTEGRATE` |
| `occlusion` | 40,547 | 16,219 | 0.14 ms | `INTEGRATE` |
| `compaction` | 40,547 | 16,219 | 0.09 ms | `INTEGRATE` |
| `indirect-draw` | 16,219 | 1 | 0.04 ms | `INTEGRATE` |
| `shading` | 2,073,600 | 2,073,600 | 1.85 ms | `INTEGRATE` |


---

## 2. Bilan Systémique vs 00-baseline
- **Soumission CPU Three.js standard (00-baseline) :** 160.1 ms ($100\,000$ draw calls distincts)
- **Soumission CPU Pipeline GPU-driven unifié :** **0.25 ms (1 seul draw call indirect)**
- **Gain net immédiat :** **+159.85 ms** (640x plus rapide)
- **Overdraw de fragment éliminé :** Zéro surcoût de rasterisation masquée grâce au couplage Hi-Z + Visibility Buffer.
