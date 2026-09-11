# Protocole R&D : Virtual Shadow Maps (VSM)

> **Règle gouvernante :** On ne complexifie le moteur que lorsqu'une mesure reproductible démontre que l'architecture actuelle limite réellement le produit.

---

## 1. Hypothèse
- **Problème identifié :** 
- **Hypothèse technique :** 
- **Seuil de déclenchement (Trigger) :** 
- **Gain attendu (KPI chiffré) :** 

---

## 2. Prototype
- **Description du banc d'essai :** 
- **Périmètre d'isolation :** 
- **Branche / Fichiers sources :** 

---

## 3. Benchmark
- **Scénario de test :** (ex. S0, S1, S2, S3, S4, S5)
- **Matériel cible :** (OS, GPU, runtime WebGPU / navigateur)
- **Métriques relevées :**
  - CPU frame / submit time (`ms`)
  - GPU frame time (`ms`)
  - P95 / P99 (`ms`)
  - Consommation mémoire VRAM (`MB`)
  - Qualité visuelle (RMS / Golden Still)

---

## 4. Profiling
- **Outils utilisés :** (Chrome Tracing, PIX / RenderDoc / Metal System Trace, WebGPU Timestamps)
- **Observations goulots :** 
- **Comportement thermique & stabilité :** 

---

## 5. Gain
- **Résultats bruts :**
  - Baseline : `... ms`
  - Prototype : `... ms`
  - Delta : `... %`
- **Confirmation de l'hypothèse :** [ ] Validée / [ ] Invalidée

---

## 6. Coût
- **Complexité du code :** (Lignes de code, dépendances, coût de maintenance)
- **Overhead mémoire / bande passante :** 
- **Coût d'intégration :** (Impact sur le pipeline de rendu existant)

---

## 7. Décision
- **Verdict :** [ ] Intégration dans le moteur principal / [ ] Maintien en veille (Watchlist) / [ ] Abandon
- **Justification :** 
- **Prochaines étapes :** 
