> **Historique non vérifié — ne pas utiliser pour une décision de performance.** Ce rapport peut contenir des estimations ou des valeurs codées en dur. Les nouveaux résultats physiques sont générés par `npm run bench` dans `benchmark-runs/measurements/`. Les modules sans banc matériel restent `not-run`.

# Rapport du Banc : 07-hiz (Hierarchical-Z Depth Pyramid)

**Date :** 2026-09-11T20:23:45.922Z  
**Statut :** `INTEGRATE`  
**Technique :** Réduction pyramidale 2x2 conservatrice (Math.max) pour culling d'occlusion.

---

## 1. Coût Matériel & Empreinte Mémoire par Résolution

| Résolution Base | Niveaux Mip | Mémoire VRAM | Temps Génération CPU/Sim |
|:---:|:---:|:---:|:---:|
| 256x256 | 9 | 0.33 Mo | 2.14 ms |
| 512x512 | 10 | 1.33 Mo | 4.60 ms |
| 1024x1024 | 11 | 5.33 Mo | 19.83 ms |


---

## 2. Invariants Hi-Z Validés
- **Convergence 1x1 :** Tout buffer (y compris dimensions impaires) converge vers un niveau racine 1x1.
- **Réduction conservatrice :** Aucun texel de profondeur n'est sous-estimé, interdisant tout faux rejet d'occlusion.
- **Requête multi-niveaux :** Sélection de mip optimale par $\log_2(\text{dimension})$ pour tester les bounding boxes avec 1 seul texel.
