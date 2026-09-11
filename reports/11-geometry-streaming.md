# Rapport du Banc : 11-geometry-streaming (Résidence VRAM & Cycle LRU)

**Date :** 2026-09-11T19:42:41.370Z  
**Statut :** `INTEGRATE`  
**Budget VRAM Alloué :** 4.0 Mo (Plafond infranchissable)

---

## 1. Trace Temporelle du Cycle de Résidence

| Trame | Action / Scénario | État Résidence | VRAM Résidente | Upload Trame | Éviction LRU | Stalls |
|:---:|---|:---:|:---:|:---:|:---:|:---:|
| Trame 1 | Chargement initial (2 Mo) | `fully-resident` | 2048 Ko | 2048 Ko | 0 Ko | 0 |
| Trame 2 | Pleine saturation du budget (4 Mo) | `fully-resident` | 4096 Ko | 2048 Ko | 0 Ko | 0 |
| Trame 3 | Éviction LRU sous pression mémoire | `eviction` | 4096 Ko | 2048 Ko | 2048 Ko | 0 |
| Trame 4 | Re-request des pages évincées | `eviction` | 4096 Ko | 2048 Ko | 2048 Ko | 0 |


---

## 2. Invariants de Streaming Validés
- **Plafond VRAM infranchissable :** Même sous demande à 100% de la scène (10 Mo), la mémoire allouée en VRAM ne dépasse jamais les 4 Mo alloués.
- **Politique LRU :** Éviction prioritaire des pages les plus anciennes non visibles cette trame.
- **Réversibilité Re-request :** Rechargement fluide sans fuite de mémoire lorsque la caméra revisite un secteur.
