# Rapport du Banc : 05-meshlets (Partitionnement en Clusters)

**Date :** 2026-09-11T19:42:41.231Z  
**Statut :** `INTEGRATE`  
**Maillage témoin :** Sphère haute résolution (1024 triangles, 561 sommets)

---

## 1. Résultats Comparatifs des Paliers de Partitionnement

| Triangles / Meshlet | Meshlets Générés | Moyenne Triangles | Facteur Duplication | Mémoire Métadonnées | Temps Partitionnement |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **64** | 16 | 64 | 1.88x | 1024 octets | 0.94 ms |
| **128** | 8 | 128 | 1.41x | 512 octets | 0.3 ms |
| **256** | 4 | 256 | 1.18x | 256 octets | 0.19 ms |
| **512** | 2 | 512 | 1.06x | 128 octets | 0.2 ms |


---

## 2. Invariants Géométriques & Validation
1. **Couverture totale :** 100% des triangles assignés à un cluster sans perte.
2. **Englobement exact :** Toutes les positions de sommets sont strictement contenues dans la sphère englobante ($d \le r$).
3. **Cône de normales :** Axe normalisé et cosHalfAngle $\in [-1, 1]$ pour le backface culling de cluster.
4. **Arbitrage de granularité :** Le palier **128 triangles** maximise la granularité de rejet tout en maintenant l'overhead des métadonnées sous 15%.
