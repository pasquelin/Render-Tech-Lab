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
Phase 2 : Mesurer & profiler (conditions contractuelles reproductibles)
   ↓
Phase 3 : Analyser les goulots d'étranglement (CPU submission, GPU raster, bande passante VRAM)
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

## 3. Règle de Simplicité des Tests de Base & Système des 3 Décisions

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

### Le Système des 3 Décisions Contractuelles

Chaque banc d'essai aboutit formellement à l'une de ces 3 décisions d'arbitrage :

| Décision | Définition & Conséquence |
|---|---|
| **`INTEGRATE`** | Intégré au moteur : le gain net est statistiquement prouvé sans régression prohibitive sur la stabilité, la latence ou la mémoire. |
| **`REJECT`** | Rejeté : le coût de calcul ou de complexité dépasse le gain produit, ou le matériel web n'en tire aucun avantage net. |
| **`WATCHLIST`** | Mis en veille conditionnelle : technique dormante en attente du franchissement d'un seuil de charge ou d'une évolution des API web. |

**Aucun test ne peut justifier à lui seul une architecture globale sans analyse complète de son coût d'intégration.**

---

## 4. Clause Contractuelle de Baseline Identique

Pour que les ratios de vitesse et de consommation mémoire soient scientifiquement inattaquables, tout benchmark comparatif doit garantir l'identité stricte de l'environnement d'exécution entre la Baseline et le Prototype :

```text
Même scène & répartition spatiale
Même caméra & trajectoire d'animation
Même géométrie source & nombre de sommets
Mêmes matériaux & propriétés d'albédo / rugosité
Même résolution de viewport (CSS & physique HiDPI)
Mêmes sources lumineuses
Même volume de visibilité / frustum
Même GPU physique & puissance de calcul
Même navigateur & version WebGPU
Même version Three.js
Même protocole de warmup & nombre d'échantillons
```

Puis seulement :

$$\text{BASELINE (Témoin)} \quad \text{vs} \quad \text{PROTOTYPE (Expérimental)}$$

---

## 5. Standard Benchmark Contract (Format Obligatoire `latest.json`)

Chaque banc d'essai enregistre obligatoirement ses résultats bruts dans `results/latest.json` selon ce schéma JSON universel :

```json
{
  "timestamp": "2026-09-11T17:30:00.000Z",
  "test": "04-gpu-lod",
  "commit": "d2eb71a",

  "status": "measured",
  "verdict": "INTEGRATE",

  "environment": {
    "gpu": "Apple M-Series GPU (WebGPU)",
    "browser": "Chrome 128 / macOS",
    "threeVersion": "0.174.0",
    "webgpuFeatures": ["indirect-first-instance"]
  },

  "scene": {
    "objects": 10000,
    "triangles": 1250000,
    "materials": 10,
    "lights": 2
  },

  "cpu": {
    "frameMs": 1.25,
    "submitMs": 0.15
  },

  "gpu": {
    "frameMs": 4.80
  },

  "memory": {
    "gpuBytes": 15728640
  },

  "draw": {
    "submitted": 10000,
    "visible": 7420
  }
}
```

**Contraintes obligatoires :**
- `status` est `"measured"` uniquement si un échantillon réel a été recueilli, sinon `"not-run"`.
- Toute métrique non mesurée vaut `null` (jamais `0`) — ne jamais fabriquer de valeur de repli.
- `verdict` est `INTEGRATE` / `REJECT` / `WATCHLIST` / `not-yet-decided`.
- Les métriques spécifiques au banc (taux de rejet, coût Hi-Z, niveaux LOD…) sont ajoutées sous la clé `customMetrics`.
- Un banc non exécuté (05→13 au moment de cette passe) porte donc `status: "not-run"` et des champs `null`.

---

## 6. Architecture Globale du Laboratoire

```text
render-tech-lab/
│
├── MASTER_TEST_PLAN.md      # Contrat maître gouvernant
│
├── tests/ (ou modules unitaires standardisés)
│   ├── 00-baseline/         [VALIDÉ]         Three.js standard (Spec 13 S0–S5, coude S3 à 2 000 objets)
│   ├── 01-indirect-draw/    [VALIDÉ]         Capacité d'absorption WebGPU drawIndexedIndirect sans culling
│   ├── 02-gpu-frustum-culling/ [NON EXÉCUTÉ] Compute shader WGSL culling atomique vs CPU culling
│   ├── 03-gpu-scene/        [VALIDÉ]         Scène hétérogène plate, ObjectBuffer, multi-topologies
│   ├── 04-gpu-lod/          [VALIDÉ]         LODs automatiques meshoptimizer + Screen-Space Error (04A/B/C)
│   ├── 05-meshlets/         [NON EXÉCUTÉ]    Partitionnement clusters (64/128/256/512 triangles) & overhead
│   ├── 06-meshlet-culling/  [NON EXÉCUTÉ]    Culling cluster (frustum, cône de normale, backface) & taux de rejet
│   ├── 07-hiz/              [NON EXÉCUTÉ]    Pyramide de profondeur Hi-Z GPU mip-map & coût générationnel
│   ├── 08-occlusion-culling/ [NON EXÉCUTÉ]  Frustum + Hi-Z sous 10% à 99% d'occlusion & équation de gain net
│   ├── 09-gpu-compaction/   [NON EXÉCUTÉ]    Compaction multi-échelles (1 thread vs atomic vs parallel scan)
│   ├── 10-material-batching/ [NON EXÉCUTÉ]  Matérialisation (switch vs storage buffer vs texture array)
│   ├── 11-geometry-streaming/ [NON EXÉCUTÉ] Résidence VRAM & cycle de vie complet de pression mémoire
│   ├── 12-visibility-buffer/ [NON EXÉCUTÉ]  Découplage passe visibilité (IDs) & shading différé
│   └── 13-full-gpu-driven/  [NON EXÉCUTÉ]    Pipeline complet unifié assemblé & bilan coût/gain systémique
│
├── shared/                  # Primitives communes strictement neutres (zéro optimisation)
│   ├── benchmark/           # Outils d'échantillonnage et de capture de métriques
│   ├── gpu/                 # Contexte partagé WebGPU, adaptateurs et périphériques
│   ├── scene/               # Générateurs pseudo-aléatoires déterministes (graine figée)
│   ├── math/                # Fonctions mathématiques pures et unitaires (SSE, projections)
│   └── fixtures/            # Maillages et scènes témoins contractuels
│
└── phase-2/                 # Recherche de modèles mathématiques propriétaires
    └── mathematical-optimization/
```

> **Règle d'or sur `shared/` :**  
> Le dossier `shared/` ne doit **jamais contenir d'optimisations prématurées**. Il ne renferme que les primitives nécessaires pour rendre les bancs strictement comparables.

---

## 7. Spécification Détaillée des 14 Bancs Unitaires

---

### Test 00 — Baseline (Three.js Standard)
- **Statut :** `not-yet-decided` — verdict historique suspendu ; consulter les données brutes de la nouvelle campagne.
- **Question gouvernante :** Quelle est la limite matérielle exacte du graphe de scène Three.js standard sans fork ?
- **Architecture :** Parcours CPU récursif d'`Object3D`, frustum culling CPU Three.js, $N$ draw calls distincts.
- **Résultat :** ancien chiffre retiré (provenance physique non vérifiée). Une campagne matérielle est requise avant toute décision de gain ou de crossover.

---

### Test 01 — Indirect Draw
- **Statut :** `not-yet-decided` — verdict historique suspendu ; consulter les données brutes de la nouvelle campagne.
- **Question gouvernante :** Est-ce que WebGPU peut absorber instantanément une commande indirecte pré-générée sans aucun culling ?
- **Architecture :** `CPU Setup ──► GPU Buffer ──► drawIndexedIndirect (1 draw call)`.
- **Scénarios de charge :** 1, 10, 100, 1 000, 10 000, 100 000 instances.
- **Résultat :** ancien chiffre retiré (provenance physique non vérifiée). Une campagne matérielle est requise avant toute décision de gain ou de crossover.

---

### Test 02 — GPU Frustum Culling
- **Statut :** banc natif atomique/workgroup disponible via `npm run bench:02`. Verdict de performance à établir après campagne matérielle.
- **Question gouvernante :** Quel gain apporte l'externalisation du test d'intersection plan/sphère sur Compute Shader WGSL ?
- **Architecture :** `ObjectBuffer ──► Compute Shader WGSL ──► atomicAdd drawIndirectBuffer ──► drawIndexedIndirect`.
- **Résultat :** ancien chiffre retiré (provenance physique non vérifiée). Une campagne matérielle est requise avant toute décision de gain ou de crossover.

---

### Test 03 — GPU Scene (Scène Hétérogène)
- **Statut :** `not-yet-decided` — verdict historique suspendu ; consulter les données brutes de la nouvelle campagne.
- **Question gouvernante :** Quel est le surcoût de gestion d'une scène hétérogène (multi-géométries, multi-matériaux, transformations dynamiques) en mémoire GPU plate ?
- **Architecture :** Mega-buffers plats (`ObjectBuffer`, `GeometryBuffer`, `MaterialBuffer`, `DrawBuffer`).
- **Résultat :** ancien chiffre retiré (provenance physique non vérifiée). Une campagne matérielle est requise avant toute décision de gain ou de crossover.

---

### Test 04 — GPU LOD & Screen-Space Error (Décomposition Tripartite)
- **Statut :** `not-yet-decided` — verdict historique suspendu ; consulter les données brutes de la nouvelle campagne.
- **Question gouvernante :** La sélection LOD sur GPU apporte-t-elle un gain net par rapport à la sélection LOD sur CPU une fois la décimation géométrique réalisée ?

Ce banc sépare rigoureusement la **génération** et la **sélection** :

```text
04-gpu-lod
│
├── 04A — Génération LOD (meshoptimizer)
│      Web Worker dédié (hors UI thread)
│      Transfert mémoire sans copie (Transferable ArrayBuffer)
│      Génération LOD 0 (100%), LOD 1 (50%), LOD 2 (25%)
│      Mesure : temps de simplification CPU, mémoire résiduelle
│
├── 04B — Sélection Screen-Space Error (CPU)
│      Fonction mathématique pure et testable
│      Sélection continue par instance sur CPU
│      Mesure : overhead CPU de la boucle de sélection pour 1k → 100k objets
│
└── 04C — Sélection Screen-Space Error (GPU)
       Compute Shader WGSL évaluant l'erreur projetée
       Sélection et compaction directe dans le DrawBuffer en VRAM
       Mesure : temps compute WGSL vs overhead CPU de 04B
```

#### Formulation Mathématique Pure du Screen-Space Error (SSE) :

$$\text{pixels} = \frac{D \times H}{2d \tan(\text{FOV} / 2)}$$

- $D$ : Diamètre englobant de l'objet (monde).
- $H$ : Hauteur du viewport (pixels).
- $d$ : Distance euclidienne objet-caméra.
- $\text{FOV}$ : Champ de vision vertical (radians).

#### Paliers de bascule :
- $\text{pixels} > 250\text{ px} \implies \text{LOD 0}$
- $60\text{ px} < \text{pixels} \le 250\text{ px} \implies \text{LOD 1}$
- $\text{pixels} \le 60\text{ px} \implies \text{LOD 2}$
- **Seuil contractuel d'erreur géométrique projetée :** $\le 1,5\text{ pixel}$ mesuré indépendamment de la performance d'affichage.

---

### Test 05 — Meshlets (Partitionnement en Clusters)
- **Question gouvernante :** Quelle granulométrie de sous-maillage (cluster) offre le meilleur équilibre entre granularité de culling et explosion des métadonnées ?
- **Architecture de données standardisée réutilisable :**
  ```wgsl
  struct Meshlet {
    sphereCenterRadius : vec4<f32>,
    coneApexCutoff     : vec4<f32>,
    coneAxis           : vec4<f32>,
    vertexOffset       : u32,
    vertexCount        : u32,
    indexOffset        : u32,
    indexCount         : u32,
  };
  ```
- **Paliers testés :** 64, 128, 256, 512 triangles par meshlet.
- **Métriques obligatoires enregistrées :**
  - Nombre total de meshlets générés.
  - Nombre moyen de triangles par meshlet.
  - Taux de duplication de sommets aux frontières (*vertex duplication factor*).
  - Empreinte mémoire des index vs métadonnées (*index memory* vs *metadata memory*).
  - Temps de partitionnement (*build time*).

---

### Test 06 — Meshlet Culling & Taux de Rejet
- **Question gouvernante :** Quel volume géométrique précis est éliminé avant rasterisation par cluster culling, et quelle part revient à chaque test ?
- **Architecture :** Compute shader WGSL exécutant 3 tests stricts : frustum, cône de normale (*backface culling*) et primitive sub-pixel.
- **Métriques de rejet obligatoires :**
  $$\text{Taux de rejet global} = \frac{\text{Meshlets rejetés}}{\text{Meshlets soumis}}$$
  Décomposition séparée et instrumentée :
  - Taux de rejet Frustum.
  - Taux de rejet Backface (cône).
  - Taux de rejet Sub-pixel.

---

### Test 07 — Hi-Z Depth Pyramid
- **Question gouvernante :** Quel est le coût matériel net (en ms GPU et bande passante VRAM) de la construction hiérarchique d'un tampon de profondeur sous WebGPU ?
- **Architecture :** Compute shader récursif effectuant un downsampling conservateur $2 \times 2$ ($\max(\text{depth})$) vers les mips $1, \dots, N$.
- **Mesure isolée :** Latence pure de génération de la pyramide par niveau de résolution ($512^2, 1024^2, 2048^2$).

---

### Test 08 — Occlusion Culling & Équation de Gain Net
- **Question gouvernante :** À partir de quel seuil d'occlusion le culling Hi-Z compense-t-il son propre surcoût de génération et de test ?
- **Équation Contractuelle de Gain Net :**
  $$\text{Gain}_{\text{net}} = \text{Coût}_{\text{baseline}} - \left(\text{Coût}_{\text{HiZ}} + \text{Coût}_{\text{culling}} + \text{Coût}_{\text{raster résiduel}}\right)$$
- **Scénarios de stress :** 10 %, 25 %, 50 %, 75 %, 90 %, 99 % d'occlusion.
- **Règle d'arbitrage :** Si $\text{Gain}_{\text{net}} \le 0$, la technique est classée `REJECT` ou `WATCHLIST` pour ce palier de charge.

---

### Test 09 — GPU Compaction & Contention
- **Question gouvernante :** Quelle méthode de compaction de liste visible résiste le mieux à l'explosion de charge et à la concurrence des threads ?
- **Variantes mesurées :**
  - **A :** 1 thread par commande (sans compaction).
  - **B :** Compaction atomique via `atomicAdd` global.
  - **C :** Algorithme Prefix Sum / Scan parallèle (Blelloch / Hillis-Steele par workgroup).
- **Paliers d'échelle :** $N = 1\,000, 10\,000, 100\,000, 1\,000\,000$ instances.
- **Métriques :** Temps GPU, contention atomique (stalls mémoire), bande passante, temps de scan.

---

### Test 10 — Material Batching (Matériaux Multiples)
- **Question gouvernante :** Quelle stratégie de matérialisation minimise réellement le coût CPU / GPU / mémoire dans l'environnement WebGPU ?
- **Variantes comparées sans a priori architectural :**
  - **A :** Bascule classique de pipeline / matériaux (*state switch*).
  - **B :** Tampon de stockage de matériaux (*Material Storage Buffer*).
  - **C :** Tableaux de textures (*Texture Arrays*).
  - **D :** Approche pseudo-bindless via atlas / indexing dynamique.
- **Mesures :** Changements d'état de pipeline, transferts bind groups, temps CPU/GPU.

---

### Test 11 — Geometry Streaming & Cycle de Pression VRAM
- **Question gouvernante :** Comment garantir un chargement asynchrone par morceaux sous contrainte stricte de budget VRAM sans saccade (*frame stutter*) ?
- **Métriques réelles de pression mémoire :**
  - Budget VRAM alloué vs mémoire résidente.
  - Volume géométrique demandé, chargé et évincé par trame.
  - Bande passante PCIe / upload WebGPU saturée.
- **Cycle de vie mesuré :**
  $$\text{Cold} \longrightarrow \text{Loading} \longrightarrow \text{Partially Resident} \longrightarrow \text{Fully Resident} \longrightarrow \text{Eviction} \longrightarrow \text{Re-request}$$

---

### Test 12 — Visibility Buffer (Architecture de Shading)
- **Question gouvernante :** Le découplage strict entre calcul de visibilité et shading différé apporte-t-il un gain net sur WebGPU face aux scènes denses ?
- **Passe 1 (Visibilité) :** Écriture compacte 32-bit (`instanceId` + `primitiveId` + depth).
- **Passe 2 (Shading différé) :** Reconstruction d'attributs et évaluation du matériau uniquement pour les pixels effectivement visibles (0 overdraw de shading).
- **Métriques :** Bande passante G-buffer vs Visibility buffer, overdraw évité, coût de lookup des matériaux.

---

### Test 13 — Full GPU-Driven Architecture
- **Question gouvernante :** La chaîne complète assemblée produit-elle un gain net supérieur à la somme des complexités et des surcoûts introduits ?
- **Bilan contractuel :** Comparaison globale contre `00-baseline` et contre chaque prototype unitaire intermédiaire.

---

## 8. Phase 2 : Recherche de Modèles Mathématiques d'Optimisation Propriétaires

Une fois les 14 bancs unitaires mesurés, le laboratoire aborde la recherche de ses propres modèles mathématiques :

1. **Partitionnement spatial adaptatif :** Arbres k-d et BVH GPU construits pour minimiser l'entropie de visibilité.
2. **Métrique d'erreur géométrique continue :** Fonction d'évaluation LOD multi-variables combinant courbure locale, contraste de texture et vitesse relative.
3. **Ordonnancement temporel des clusters :** Réutilisation de la cohérence d'occlusion trame à trame via reprojection temporelle ($t - 1$).
4. **Algorithme de compaction WebGPU optimal :** Schéma de balayage hiérarchique optimisé pour les tailles réelles de *subgroups* WebGPU.
5. **Estimateur prédictif de résidence VRAM :** Modèle stochastique d'éviction géométrique anticipant la réapparition des objets.
