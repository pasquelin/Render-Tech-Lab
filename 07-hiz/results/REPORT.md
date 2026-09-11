# Rapport du Banc : 07-hiz (Hierarchical-Z Depth Pyramid)

**Date :** 2026-09-11T19:56:56.546Z  
**Statut :** `INTEGRATE`  
**Technique :** Réduction pyramidale 2x2 conservatrice (Math.max) pour culling d'occlusion.

---

## 1. Coût Matériel & Empreinte Mémoire par Résolution

| Résolution Base | Niveaux Mip | Mémoire VRAM | Temps Génération CPU/Sim |
|:---:|:---:|:---:|:---:|
| 256x256 | 9 | 0.33 Mo | 1.84 ms |
| 512x512 | 10 | 1.33 Mo | 6.56 ms |
| 1024x1024 | 11 | 5.33 Mo | 19.98 ms |


---

## 2. Invariants Hi-Z Validés
- **Convergence 1x1 :** Tout buffer (y compris dimensions impaires) converge vers un niveau racine 1x1.
- **Réduction conservatrice :** Aucun texel de profondeur n'est sous-estimé, interdisant tout faux rejet d'occlusion.
- **Requête multi-niveaux :** Sélection de mip optimale par $\log_2(\text{dimension})$ pour tester les bounding boxes avec 1 seul texel.
