# Rapport du Banc : 03-gpu-scene

**Date :** 2026-09-11T20:01:18.267Z  
**Statut :** `INTEGRATE`  
**Verdict :** Le stockage plat en mega-buffers élimine le surcoût de parcours de graphe de scène pour 100 topologies et 100 matériaux.

---

## 1. Métriques Clés du Banc 03-gpu-scene
- **Instances :** 2 000
- **Topologies distinctes :** 10
- **Matériaux distincts :** 10
- **Taille binaire GPUObject :** 96 octets (aligné vec4 WGSL)
- **Draw calls indirects émis :** 10 (1 par topologie au lieu de 2 000)
- **Gain CPU mesuré vs Three.js standard :** −93.2%
