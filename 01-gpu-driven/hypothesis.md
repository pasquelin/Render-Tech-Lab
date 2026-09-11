# Protocole R&D : 01-gpu-driven (Architecture GPU-Driven)

> **Règle gouvernante :** On ne complexifie le moteur que lorsqu'une mesure reproductible démontre que l'architecture actuelle limite réellement le produit.

---

## 1. Hypothèse
- **Problème identifié :** Dans Three.js standard, le rendu de scènes comportant un nombre élevé d'objets uniques (scénario S3 : $\ge 2\,000$ objets) sature le thread principal en CPU submission (`submitMs`). Le culling CPU requiert de traverser le graphe de scène, d'évaluer le frustum objet par objet, et d'encoder individuellement des milliers de draw calls, ce qui crée un goulot d'étranglement bien avant la saturation du GPU.
- **Hypothèse technique :** Déporter le frustum culling et la génération des commandes de dessin dans un Compute Shader WebGPU écrivant dans un buffer `drawIndexedIndirect`, tout en conservant une scène aplatie en `StorageBuffer` GPU sans retour CPU (zéro round-trip), réduira `submitMs` à une valeur constante $O(1)$ et débloquera le taux de rafraîchissement.
- **Seuil de déclenchement (Trigger / Crossover) :** L'architecture GPU-driven est justifiée si le point de croisement (*crossover point*) survient à $\le 2\,000$ objets uniques, avec un gain sur le frametime CPU d'au moins 50% sur le scénario S3 ($2\,000$ objets), sans dégradation inacceptable du frametime GPU ($\le +0.5\,\text{ms}$ pour la passe compute).
- **Gain attendu (KPI chiffré) :** 
  - `CPU submitMs` réduit de $> 70\%$ sur 2 000 objets.
  - Taux d'images par seconde stabilisé à 60 FPS constants sur scènes denses.
  - 1 seul draw call CPU au lieu de $N$ draw calls.

---

## 2. Prototype
- **Description du banc d'essai :** 
  - Même scène procédurale générant $N$ maillages uniques disposés dans un volume 3D avec caméra orbitale / trajectoire oscillante.
  - Comparaison directe entre **Test A** (Three.js classique avec `WebGPURenderer`) et **Test B** (Mini-renderer GPU-driven avec `IndirectStorageBufferAttribute` et compute pass).
- **Périmètre d'isolation :** Les deux tests partagent rigoureusement les mêmes géométries, matériaux PBR et matrices de projection caméra.
- **Fichiers sources :** 
  - `01-gpu-driven/baseline/` (Test A)
  - `01-gpu-driven/implementation/` (Test B)
  - `01-gpu-driven/benchmark/` (Runner & Métriques)

---

## 3. Benchmark
- **Scénarios de test :** Paliers de charge à 500, 1 000, 2 000 et 5 000 objets.
- **Matériel cible :** macOS (Metal via WebGPU), Chrome/Edge avec WebGPU activé.
- **Métriques relevées :**
  - `CPU frame time` (`ms`)
  - `CPU submitMs` (`ms`)
  - `GPU frame time` via timestamp queries (`ms`)
  - `Draw calls CPU count`
  - `GPU Compute dispatches`
  - Consommation mémoire VRAM (`MB`)

---

## 4. Profiling
- **Outils utilisés :** Performance Timeline / User Timing API, Chrome Tracing (`chrome://tracing`), Metal System Trace / WebGPU Timestamp Queries.
- **Observations goulots :** Analyse de la courbe de charge CPU submission vs coût fixe du dispatch compute.
- **Comportement thermique & stabilité :** Absence de memory leak et stabilité des allocations de buffers indirects.

---

## 5. Gain
- **Résultats bruts :**
  - Palier 500 objets : Baseline `... ms` vs GPU-driven `... ms` (Delta : `... %`)
  - Palier 1 000 objets : Baseline `... ms` vs GPU-driven `... ms` (Delta : `... %`)
  - Palier 2 000 objets : Baseline `... ms` vs GPU-driven `... ms` (Delta : `... %`)
  - Palier 5 000 objets : Baseline `... ms` vs GPU-driven `... ms` (Delta : `... %`)
- **Point de croisement constaté :** `... objets`
- **Confirmation de l'hypothèse :** [ ] Validée / [ ] Invalidée

---

## 6. Coût
- **Complexité du code :** Gestion explicite des StorageBuffers de scène, maintenance des shaders de culling compute WGSL/TSL.
- **Overhead mémoire / bande passante :** VRAM additionnelle pour le buffer de commandes indirectes et le buffer de records d'instances.
- **Coût d'intégration :** Évaluation du passage Niveau A (TSL direct) vs Niveau B (Three.js common backend) vs Niveau C (Fork expérimental).

---

## 7. Décision
- **Verdict :** [ ] Intégration dans le moteur principal / [ ] Maintien en veille (Watchlist) / [ ] Abandon
- **Justification :** 
- **Prochaines étapes :** (Phase 3 : Ajout de la sélection LOD screen-space GPU).
