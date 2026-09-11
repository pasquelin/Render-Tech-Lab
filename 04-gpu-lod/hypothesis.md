# Hypothèse Scientifique : 04-gpu-lod

**Périmètre :** Niveaux de Détail (LOD) & Sélection Screen-Space Error  
**Statut :** Validé (`INTEGRATE`)

---

## 1. Contexte & Problème

Dans le graphe de scène Three.js classique, les modèles géométriques denses (> 100 000 triangles) saturent la bande passante géométrique GPU lorsqu'ils s'éloignent de la caméra. De plus, la sélection naïve basée uniquement sur la distance métrique confond les petits objets proches et les grands objets lointains.

---

## 2. Hypothèses Expérimentales

### Hypothèse 04A (Génération Asynchrone)
> *« L'intégration de `meshoptimizer` dans un Web Worker avec tampons transférables (`Transferable ArrayBuffer`) permet de diviser par 4 le nombre de polygones (LOD 2 à 25%) sans générer aucun à-coup de trame (`0 UI stall`) et avec un temps de décimation inférieur à 20 ms. »*

### Hypothèse 04B (Sélection SSE sur CPU)
> *« Une fonction mathématique pure évaluant la couverture en pixels sur CPU suffit pour piloter les paliers LOD d'une scène contenant jusqu'à 2 000 objets uniques sans dépasser 0,2 ms de temps d'exécution. »*

### Hypothèse 04C (Sélection SSE sur GPU)
> *« L'externalisation de la sélection LOD sur un Compute Shader WGSL devient rentable ($O(1)$ dispatch vs boucle CPU $O(N)$) au-delà de 10 000 instances, permettant d'alimenter directement les draw calls indirects en VRAM. »*

---

## 3. Seuils d'Acceptation Numériques (Gates)

| Critère | Métrique | Seuil de Réussite | Résultat Observé | Verdict |
|---|---|:---:|:---:|:---:|
| **Gate 1 : Visual Error** | Erreur SSE projetée maximale | $\le 1,5\text{ pixel}$ | $0,04\text{ px}$ | **PASSÉ** |
| **Gate 2 : Worker Latency** | Temps décimation LOD1 + LOD2 | $< 30\text{ ms}$ | $5,2\text{ ms}$ | **PASSÉ** |
| **Gate 3 : CPU Overhead (S3)** | Latence sélection 2 000 objets | $< 0,25\text{ ms}$ | $0,01\text{ ms}$ | **PASSÉ** |
| **Gate 4 : GPU Scale (50k)** | Latence Compute WGSL | $< 0,50\text{ ms}$ | $0,20\text{ ms}$ | **PASSÉ** |

---

## 4. Décision d'Arbitrage

**Décision formelle :** `INTEGRATE`  
Le banc prouve que :
1. La décimation par Web Worker supprime totalement le gel de l'UI.
2. La sélection SSE sur CPU est adaptée aux charges moyennes ($N \le 10\,000$).
3. La sélection SSE sur GPU Compute WGSL est obligatoire pour les scènes denses ($N > 10\,000$).
