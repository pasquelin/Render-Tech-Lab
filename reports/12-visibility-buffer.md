# Rapport du Banc : 12-visibility-buffer (Visibilité Découplée)

**Date :** 2026-09-11T18:41:16.894Z  
**Statut :** `INTEGRATE`  
**Principe :** Passe 1 (Raster ID 32-bit + Depth) ──► Passe 2 (Compute Shading barycentrique sans surdessin)

---

## 1. Empreinte Mémoire & Économie de Bande Passante VRAM

| Résolution | G-Buffer Standard (Forward/Def) | Visibility Buffer (Passe 1) | Facteur d'Économie |
|:---:|:---:|:---:|:---:|
| **1080p** | 55.4 Mo | **15.8 Mo** | **3.5x plus léger** |
| **1440p** | 98.4 Mo | **28.1 Mo** | **3.5x plus léger** |
| **4K** | 221.5 Mo | **63.3 Mo** | **3.5x plus léger** |


---

## 2. Invariants Validés
- **Encodage réversible sans perte :** Mot 32-bit allouant 16 bits d'instance (65 536 objets) et 16 bits de primitive (65 536 triangles par cluster).
- **Zéro overdraw de calcul :** Les fragments occlus ne consomment aucun cycle de shading complexe (BRDF, textures, ombres).
- **Interpolation exacte :** Reconstruction mathématique analytique en perspective des attributs aux sommets ($U, V, N, T$).
