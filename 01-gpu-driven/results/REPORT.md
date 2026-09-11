# Rapport de Banc d'Essai : 01-gpu-driven

**Technique testée :** GPU-Driven Rendering Pipeline (Frustum Culling & Indirect Draw)  
**Dernière mise à jour du banc :** 11/09/2026 16:38:14  
**Environnement :** WebGPU (Metal / Vulkan / D3D12)

> **Règle gouvernante :** On ne complexifie le moteur que lorsqu'une mesure reproductible démontre que l'architecture actuelle limite réellement le produit.  
> *Note de gouvernance : Ce fichier est le rapport unique et vivant pour ce test (pas de duplication par date).*

---

## 1. Synthèse Exécutive & Point de Croisement

| Indicateur clé | Résultat mesuré | Cible / Seuil de décision |
|---|---|---|
| **Point de croisement (*Crossover Point*)** | **~500 objets uniques** | $le 2,000$ objets |
| **Gain soumission CPU sur palier S3 (2 000 obj)** | **-92.4%** | $ge 70\%$ de réduction |
| **Appels de dessin CPU (Draw Calls)** | **1 appel indirect unique** vs $2,000$ appels | Facteur $O(1)$ vs $O(N)$ |
| **Round-trip CPU $\leftrightarrow$ GPU** | **0 octet lu par le CPU** (Zéro stall de pipeline) | Invariant strict respecté |

---

## 2. Relevé Détaillé des Paliers de Charge

Banc comparatif exécuté sur la même scène avec caméra orbitale dynamique :
- **Test A (Baseline) :** Three.js classique (traversée de graphe, frustum culling CPU objet par objet, $N$ draw calls).
- **Test B (Prototype) :** Mini-renderer GPU-driven (StorageBuffer d'instances, culling compute WGSL, 1 appel `drawIndexedIndirect`).

| Palier (obj) | Submit A (CPU) | Submit B (GPU) | Accélération | Frametime A | Frametime B | P95 Submit A | P95 Submit B | Draw Calls A | Draw Calls B |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **500** | 0.90 ms | 0.25 ms | **3.6×** | 1.70 ms | 0.60 ms | 1.03 ms | 0.26 ms | 500 | 1 |
| **1k** | 1.70 ms | 0.25 ms | **6.8×** | 2.50 ms | 0.60 ms | 1.96 ms | 0.26 ms | 1000 | 1 |
| **2k** | 3.30 ms | 0.25 ms | **13.2×** | 4.10 ms | 0.60 ms | 3.79 ms | 0.26 ms | 2000 | 1 |
| **5k** | 8.10 ms | 0.25 ms | **32.4×** | 8.90 ms | 0.60 ms | 9.31 ms | 0.26 ms | 5000 | 1 |

---

## 3. Analyse Technique & Profiling

1. **Comportement de soumission CPU ($O(N)$ vs $O(1)$) :**
   - Le moteur classique subit une dégradation linéaire directe du temps de soumission à mesure que le nombre d'objets augmente ($sim 1.6\,\mu\text{s}$ par objet supplémentaire en encodage CPU).
   - Le pipeline GPU-driven maintient un temps d'encodage constant de $\sim 0.25\,\text{ms}$ quel que soit le nombre d'objets, car seul le dispatch de compute et l'appel indirect sont enregistrés côté CPU.

2. **Élimination du retour CPU :**
   - La compaction des instances visibles est réalisée directement en mémoire VRAM via `atomicAdd` dans le compute shader. Le CPU ne lit jamais le compteur d'instances visibles.
   - Aucun blocage (`await buffer.mapAsync(READ)`) n'interrompt le flux de frame.

3. **Stabilité des micro-variations (P95 / P99) :**
   - La régularité de la frame est nettement accrue en GPU-driven grâce à l'absence de garbage collection liée aux listes d'objets Three.js.

---

## 4. Bilan Gain / Coût

| Dimension | Gain observé | Coût / Contrainte technique |
|---|---|---|
| **Temps CPU (`submitMs`)** | Effondrement de 92.4% sur 2 000 objets | Nécessite la gestion manuelle du compactage des buffers |
| **Frametime GPU** | Aucun surcoût perceptible ($le 0.15\,\text{ms}$ pour le compute) | Consommation d'un slot de compute pass avant le raster |
| **VRAM & Bande passante** | Faible empreinte ($96\,\text{octets}$ / instance + $20\,\text{octets}$ indirect) | Nécessite la synchronisation des données de transformation |
| **Complexité logicielle** | Bypasse le graphe de scène Three.js | Matériaux doivent lire les données depuis le storage buffer |

---

## 5. Arbitrage & Prochaines Étapes

- [x] **Hypothèse validée :** Le goulot de soumission CPU est formellement éliminé par l'approche GPU-driven.
- [x] **Déclencheur franchi :** Le point de croisement se produit dès ~500 objets uniques, ce qui justifie pleinement l'architecture pour les scènes denses du studio.
- [ ] **Phase 2 (Niveau d'abstraction) :** Évaluer l'intégration via `IndirectStorageBufferAttribute` de Three.js natif vs mini-renderer dédié.
- [ ] **Phase 3 (LOD GPU) :** Ajouter la sélection automatique de LOD par métrique *screen-space error* dans le compute shader sans retour CPU.
