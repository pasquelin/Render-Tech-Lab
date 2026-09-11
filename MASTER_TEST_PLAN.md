# GPU-Driven / Nanite-Inspired — Master Test Plan

## Contrat d'Exécution & Méthodologie du Laboratoire R&D

> **Règle d'or gouvernante du laboratoire :**  
> *« Aucune infrastructure majeure n'est adoptée sans qu'un banc démontre que l'architecture actuelle est le facteur limitant. »*

---

## 1. Objectif & Principes Fondamentaux

Construire, isoler et mesurer rigoureusement et indépendamment toutes les briques fondamentales nécessaires à une architecture de rendu GPU-driven de très haute performance dans l'écosystème WebGPU / Three.js.

### Les 6 Phases d'Exécution

```text
Phase 1 : Construire les tests de base unitaires (simples et isolés)
   ↓
Phase 2 : Mesurer & profiler (conditions reproductibles)
   ↓
Phase 3 : Analyser les goulots d'étranglement (CPU submission, GPU raster, bande passante)
   ↓
Phase 4 : Développer nos optimisations mathématiques propriétaires
   ↓
Phase 5 : Combiner les optimisations validées
   ↓
Phase 6 : Comparer globalement avec les baselines initiales
```

**Règle méthodologique absolue :**  
Aucune optimisation complexe n'est introduite avant que son test de base n'existe, ne soit mesurable et n'ait mis en évidence un goulot matériel documenté.

---

## 2. Philosophie du Laboratoire

> **Nanite constitue une référence architecturale, pas une spécification à reproduire à l'aveugle.**

Le laboratoire doit déterminer expérimentalement :
1. Quelles propriétés mathématiques et matérielles rendent une architecture GPU-driven réellement efficace sur le web.
2. Quels algorithmes sont fidèlement adaptés aux contraintes de l'API WebGPU (modèle mémoire, limitations des *workgroups*, absence de *bindless* natif complet).
3. Quels compromis sont nécessaires et viables au sein de l'écosystème Three.js / TSL.
4. Quelles optimisations mathématiques propriétaires peuvent dépasser les implémentations génériques de l'industrie.
5. À partir de quel seuil de charge précis chaque brique technologique franchit son point de rentabilité (*crossover point*).

---

## 3. Règle de Simplicité des Tests de Base

**Les tests de base ne doivent pas être artificiellement optimisés pour exhiber de beaux chiffres.**  
Ils doivent être volontairement élémentaires et lisibles.

```text
TEST UNITAIRE DE BASE
         ↓
Compréhension mécanique
         ↓
Mesure fiable & reproductible
         ↓
Identification du goulot
         ↓
OPTIMISATION CIBLÉE
         ↓
Nouveau benchmark comparatif
```

C'est cette traçabilité expérimentale continue qui constitue la valeur scientifique du laboratoire :

$$\text{Baseline Standard (100 ms)} \longrightarrow \text{GPU-Driven (10 ms)} \longrightarrow \text{GPU LOD (6 ms)} \longrightarrow \text{Meshlets (3 ms)} \longrightarrow \text{Hi-Z (1.8 ms)} \longrightarrow \text{Modèle Mathématique Propriétaire (1.2 ms)}$$

---

## 4. Format Obligatoire de Chaque Banc d'Essai

Chaque module unitaire doit impérativement respecter la structure standardisée des 5 tiroirs :

```text
XX-nom-du-test/
├── README.md               # Présentation, question gouvernante et arbitrage
├── hypothesis.md           # Hypothèse scientifique, variables de stress et seuils (gates)
├── implementation.md       # Architecture technique (buffers, formats, shaders WGSL)
├── benchmark.md            # Protocole automatisé, paliers et reproductibilité
├── results/
│   └── latest.json         # Données brutes horodatées issues du banc
└── report.md / REPORT.md   # Rapport vivant d'arbitrage (Executive summary, gains, limites)
```

Cycle d'exécution strict :

$$\text{Hypothèse} \longrightarrow \text{Baseline} \longrightarrow \text{Prototype Minimal} \longrightarrow \text{Mesure} \longrightarrow \text{Profiling} \longrightarrow \text{Analyse} \longrightarrow \text{Conclusion}$$

---

## 5. Architecture des 14 Tests Unitaires (00 à 13)

```text
tests/
│
├── 00-baseline/             [VALIDÉ] Socle Three.js standard (Spec 13 S0–S5, coude S3 à 2 000 objets)
├── 01-indirect-draw/        [VALIDÉ] Capacité d'absorption WebGPU drawIndexedIndirect sans culling
├── 02-gpu-frustum-culling/  [VALIDÉ] Compute shader WGSL culling atomique vs CPU culling
├── 03-gpu-scene/            [VALIDÉ] Scène hétérogène plate, ObjectBuffer, multi-topologies
├── 04-gpu-lod/              [PROCHAIN] LODs automatiques meshoptimizer (Worker) + Screen-Space Error
├── 05-meshlets/             Partitionnement en clusters (64, 128, 256, 512 triangles)
├── 06-meshlet-culling/      Culling par cluster (frustum, cône de normale, backface)
├── 07-hiz/                  Pyramide de profondeur Hi-Z GPU mip-map
├── 08-occlusion-culling/    Frustum + Hi-Z sous 10% à 99% d'occlusion
├── 09-gpu-compaction/       Comparatif compaction (1 thread/cmd vs atomic vs scan parallèle)
├── 10-material-batching/    Gestion 1 à 10k matériaux sans bascule de pipeline
├── 11-geometry-streaming/   Résidence VRAM et streaming géométrique partiel (10% à 100%)
├── 12-visibility-buffer/    Découplage visibilité (IDs) et passe de shading différé
└── 13-full-gpu-driven/      Architecture complète unifiée assemblée
```

---

### Test 00 — Baseline (Three.js Standard)
- **Statut :** Validé (Socle étalon Spec 13 S0–S5).
- **Question gouvernante :** Quelle est la limite matérielle exacte du graphe de scène Three.js classique ?
- **Architecture :** Parcours CPU récursif, frustum culling CPU Three.js, $N$ draw calls distincts.
- **Résultat étalon :** Coude CPU identifié à S3 (2 000 objets uniques) : 3,35 ms de soumission CPU, 2 002 draw calls, 60 FPS. Chute à 8,45 ms et 54 FPS à S5 (5 000 objets uniques).

---

### Test 01 — Indirect Draw
- **Statut :** Validé (intégré dans le banc `01-gpu-driven`).
- **Question gouvernante :** Est-ce que WebGPU peut absorber instantanément une commande indirecte pré-générée sans aucun culling ?
- **Architecture :** 
  ```text
  CPU Setup ──► GPU Buffer (indirect args) ──► drawIndexedIndirect (1 draw call)
  ```
- **Scénarios de charge :** 1, 10, 100, 1 000, 10 000, 100 000 instances.
- **Métriques :** Temps de soumission CPU, latence GPU, mémoire indirecte allouée.

---

### Test 02 — GPU Frustum Culling
- **Statut :** Validé (intégré dans le banc `01-gpu-driven`).
- **Question gouvernante :** Quel gain apporte l'externalisation du test d'intersection plan/sphère sur Compute Shader WGSL ?
- **Architecture :**
  ```text
  ObjectBuffer (AABB/sphères)
         ↓
  Compute Shader WGSL (1 thread / instance, test 6 plans frustum)
         ↓
  atomicAdd sur drawIndirectBuffer (compaction atomique)
         ↓
  1 × drawIndexedIndirect
  ```
- **Résultat étalon :** −92,7% de soumission CPU à 2 000 objets (0,25 ms vs 3,35 ms), crossover rentable dès 1 000 objets.

---

### Test 03 — GPU Scene (Scène Hétérogène)
- **Statut :** Validé (intégré dans le banc `02-gpu-scene`).
- **Question gouvernante :** Quel est le surcoût de gestion d'une scène hétérogène (multi-géométries, multi-matériaux, transformations dynamiques) en mémoire GPU plate ?
- **Architecture :**
  - `ObjectBuffer` : matrices monde $4 \times 4$, bounding spheres, `geometryId`, `materialId`.
  - `GeometryBuffer` : `indexOffset`, `indexCount`, `vertexOffset`.
  - `MaterialBuffer` : albédo, rugosité, métal, flags.
  - `DrawBuffer` : compaction dynamique et draw calls indirects hétérogènes.
- **Résultat étalon :** −93,2% de temps CPU sous charge dynamique 4D (100 topologies, 100 matériaux).

---

### Test 04 — GPU LOD & Screen-Space Error (Spécification 16)
- **Statut :** Prochaine étape prioritaire (Lot D1).
- **Question gouvernante :** Comment sélectionner le LOD optimal au pixel près sans jamais bloquer le thread d'interface UI ?
- **Architecture :**
  1. **Décimation hors thread UI :** Web Worker `lodWorker.ts` exploitant `meshoptimizer` via `Transferable ArrayBuffer`. Génération de LOD0 (100%), LOD1 (50%), LOD2 (25%).
  2. **Sélection par Screen-Space Error (SSE) :**  
     Calcul de la couverture réelle en pixels :
     $$\text{pixels} = \frac{\text{diametreEnglobant} \times \text{hauteurEcran}}{2 \times \text{distance} \times \tan(\text{FOV} / 2)}$$
  3. **Règle de bascule continue :**
     - $\text{pixels} > 250\text{ px} \implies \text{LOD 0}$
     - $60\text{ px} < \text{pixels} \le 250\text{ px} \implies \text{LOD 1}$
     - $\text{pixels} \le 60\text{ px} \implies \text{LOD 2}$
     - Seuil d'erreur géométrique projetée tolérée : $\le 1,5\text{ pixel}$.
- **Scénarios de test :** Paliers d'erreur 0.5 px, 1.0 px, 1.5 px, 2.0 px, 4.0 px.

---

### Test 05 — Meshlets (Partitionnement en Clusters)
- **Question gouvernante :** Quelle granulométrie de sous-maillage (cluster) offre le meilleur ratio débit géométrique / overhead de métadonnées sur WebGPU ?
- **Architecture :**
  - Partitionnement géométrique d'un maillage dense en clusters autonomes : 64, 128, 256, ou 512 triangles.
  - Structure de données cluster :
    ```wgsl
    struct Meshlet {
      sphereCenterRadius : vec4<f32>,
      coneApexCutoff     : vec4<f32>,
      coneAxis           : vec4<f32>,
      vertexOffset       : u32,
      triangleOffset     : u32,
      vertexCount        : u32,
      triangleCount      : u32,
    };
    ```
- **Tests comparatifs :** Tailles de clusters 64 vs 128 vs 256 vs 512 triangles.

---

### Test 06 — Meshlet Culling
- **Question gouvernante :** Quel volume de triangles peut être éliminé avant la rasterisation par un culling fin à l'échelle du cluster ?
- **Architecture :** Compute Shader WGSL exécutant 3 tests stricts :
  1. *Frustum culling* sur la bounding sphere du meshlet.
  2. *Backface cone culling* : élimination des clusters orientés à l'opposé de la caméra.
  3. *Small primitive culling* : rejet des meshlets dont la projection est inférieure à 1 pixel.
- **Comparaison obligatoire :** Élimination par objet global vs élimination par meshlet.

---

### Test 07 — Hi-Z Depth Pyramid
- **Question gouvernante :** Quelle est la méthode la plus rapide sous WebGPU pour générer une pyramide de profondeur hiérarchique (Hi-Z) à chaque frame ?
- **Architecture :**
  - Capture de la depth texture après la passe opaque primaire ou pré-passe de profondeur.
  - Compute shader récursif effectuant un downsampling $2 \times 2$ conservateur ($\max(\text{depth})$) générant les mips $1, 2, \dots, N$.
- **Validation :** Contrôle de fidélité et coût GPU de la réduction multi-niveaux.

---

### Test 08 — Occlusion Culling
- **Question gouvernante :** Quel est le seuil de complexité de scène à partir duquel l'occlusion culling Hi-Z compense son propre coût de calcul ?
- **Architecture :**
  - Projection de la bounding sphere ou boîte englobante dans le mip approprié de la texture Hi-Z.
  - Comparaison $z_{\text{min}}$ vs $z_{\text{pyramide}}$.
- **Paliers d'occlusion testés :** 10 %, 25 %, 50 %, 75 %, 90 %, 99 % d'objets masqués.
- **Métriques :** Triangles rejetés, temps de culling GPU, temps de rasterisation net.

---

### Test 09 — GPU Compaction
- **Question gouvernante :** Quelle architecture de compaction de liste visible surpasse l'atomicAdd classique lors de fortes concurrences de threads ?
- **Variantes mesurées :**
  - **A :** 1 thread par commande (sans compaction).
  - **B :** Compaction atomique via `atomicAdd` global.
  - **C :** Algorithme Prefix Sum / Scan parallèle (Blelloch / Hillis-Steele par workgroup).
- **Objectif :** Conception de notre propre algorithme de compaction optimal sans conflit d'écriture.

---

### Test 10 — Material Batching (Matériaux Multiples)
- **Question gouvernante :** Comment gérer de 1 à 10 000 matériaux PBR sans aucune rupture d'état de pipeline ni duplication de draw call ?
- **Architecture :**
  - Stockage des paramètres PBR dans un `MaterialStorageBuffer`.
  - Texture Arrays ou Atlas de textures pour regrouper albédo, normales, roughness, metalness.
  - Accès direct via `materialId` sans changement de bind group.
- **Paliers de stress :** 1, 10, 100, 1 000, 10 000 matériaux actifs.

---

### Test 11 — Geometry Streaming & Résidence VRAM
- **Question gouvernante :** Comment orchestrer un chargement asynchrone par morceaux sans saturer la bande passante PCIe ni provoquer de saccades (hiccups) ?
- **Architecture :**
  - Gestionnaire de résidence VRAM avec allocation en anneau (*ring-buffer*) ou par pages virtuelles.
  - Paliers de résidence testés : 100 % résident, 50 %, 25 %, 10 %.
  - Détection de visibilité demandant le streaming des clusters manquants.

---

### Test 12 — Visibility Buffer
- **Question gouvernante :** Le découplage strict entre calcul de visibilité géométrique et shading différé apporte-t-il un gain net sur WebGPU ?
- **Architecture :**
  - **Passe 1 (Visibility Pass) :** Rasterisation ultra-légère écrivant uniquement un identifiant 32-bit compact (`instanceId` + `primitiveId`) et le tampon de profondeur.
  - **Passe 2 (Material & Shading Pass) :** Évaluation plein écran du matériau correspondant uniquement pour les pixels effectivement visibles (0 overdraw de shading).

---

### Test 13 — Full GPU-Driven Architecture
- **Question gouvernante :** Quel gain d'ensemble fournit le pipeline complet unifié comparativement au témoin zéro `00-baseline` ?
- **Pipeline Intégré :**
  ```text
  GPU Scene (Mega-Buffers)
          ↓
  LOD Selection (Screen-Space Error)
          ↓
  Cluster/Meshlet Hierarchy
          ↓
  GPU Frustum Culling + Backface Cone Culling
          ↓
  Hi-Z Occlusion Culling
          ↓
  Parallel Scan Compaction
          ↓
  1 × Multi-Draw Indexed Indirect
          ↓
  Visibility Buffer / Deferred Material Shading
  ```

---

## 6. Phase 2 : Recherche de Modèles Mathématiques d'Optimisation

Une fois tous les bancs unitaires de base mesurés et leurs goulots identifiés, le laboratoire bascule en **Phase de Recherche Propriétaire**.

Nous formulerons et validerons nos propres modèles mathématiques sur les axes suivants :

1. **Partitionnement spatial adaptatif :** Arbres k-d et BVH GPU construits pour minimiser l'entropie de visibilité.
2. **Métrique d'erreur géométrique continue :** Fonction d'évaluation LOD multi-variables combinant courbure locale, contraste de texture et vitesse relative.
3. **Ordonnancement temporel des clusters :** Réutilisation de la cohérence d'occlusion trame à trame via reprojection de trame antérieure ($t - 1$).
4. **Algorithme de compaction WebGPU sans conflit :** Schéma de balayage hiérarchique optimisé pour la taille des *subgroups* WebGPU modernes.
5. **Allocation et défragmentation mémoire VRAM :** Modèle prédictif d'éviction de géométrie fondé sur un estimateur de probabilité de réapparition.

---

## 7. Tableau d'Alignement des Modules du Laboratoire

| Test ID | Dossier | Statut | Contribution Clé | Dépendance |
|---|---|:---:|---|---|
| **00** | `00-baseline` | **VALIDÉ** | Matrice de référence Spec 13 S0–S5, coude S3 à 3,35 ms | Three.js |
| **01** | `01-gpu-driven` | **VALIDÉ** | Validation `drawIndexedIndirect` & absorption GPU | WebGPU |
| **02** | `01-gpu-driven` | **VALIDÉ** | Compute frustum culling WGSL atomique (−92,7% CPU) | WebGPU WGSL |
| **03** | `02-gpu-scene` | **VALIDÉ** | Scène hétérogène, mega-buffers, stress 4D (−93,2% CPU) | WebGPU |
| **04** | `03-gpu-lod` | **PROCHAIN** | Spec 16 : Worker `meshoptimizer` + Screen-Space Error | `meshoptimizer` |
| **05** | `04-meshlets` | Planifié | Partitionnement clusters 64/128/256/512 triangles | Worker |
| **06** | `05-meshlet-culling` | Planifié | Culling cluster cône de normale + frustum | WebGPU WGSL |
| **07** | `06-hiz` | Planifié | Pyramide de profondeur GPU mip-map | Compute Shader |
| **08** | `07-occlusion-culling` | Planifié | Occlusion Hi-Z 10% à 99% d'occlusion | Texture Hi-Z |
| **09** | `08-gpu-compaction` | Planifié | Benchmark compaction : 1 thread vs atomic vs Blelloch Scan | Compute Shader |
| **10** | `09-material-batching` | Planifié | 1 à 10k matériaux sans bascule de pipeline | Texture Arrays |
| **11** | `10-geometry-streaming`| Planifié | Résidence VRAM 10% à 100% et chargement asynchrone | VRAM Manager |
| **12** | `11-visibility-buffer` | Planifié | Passe Primitive ID / Material ID + shading différé | G-Buffer WebGPU |
| **13** | `12-full-gpu-driven`   | Planifié | Architecture globale unifiée intégrée | Pipeline Complet |
