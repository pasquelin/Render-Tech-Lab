# Index des spécifications — Atelier du 2026-09-11

Ce dossier rassemble les **18 spécifications techniques détaillées** arrêtées à l'issue de huit cycles de revue contradictoire (révision `e69a84b29`).

---

## La règle gouvernante d'architecture

> **Aucune infrastructure majeure n'est adoptée parce qu'elle est standard dans les moteurs modernes. Elle est adoptée lorsqu'un banc reproductible démontre que l'architecture actuelle est le facteur limitant, et que le gain attendu est chiffré.**
> 
> *Corollaire : Le banc doit prouver que le studio a un problème avant que le moteur ne soit autorisé à devenir plus complexe.*

### Ce que le studio cherche à être
Pas « le moteur capable de rendre le plus grand monde possible », mais celui qui offre **le meilleur rapport qualité visuelle / latence d'interaction / stabilité / coût GPU pour les scènes que cet atelier crée et exporte réellement**.

---

## Vue d'ensemble des 18 spécifications actives

| N° | Spécification | Périmètre / Lot | Objectif technique |
|:---:|---|---|---|
| **01** | [Import clic droit explorateur](01-import-clic-droit-explorateur.md) | Lot 3 — Menus contextuels | Menus unifiés par OS (macOS/Win/Linux) |
| **02** | [Clic droit panneau Scène](02-clic-droit-panneau-scene.md) | Lot 3 — Menus contextuels | Actions Racine, Cibler, Presse-papier |
| **03** | [Glisser-déposer vers scène](03-glisser-deposer-explorateur-scene.md) | Lot 2 — Drag & Drop | Raycast d'impact, plan $Y=0$, outliner |
| **04** | [Rangement modèles & textures](04-rangement-import-modele-textures.md) | Lot 4 — Import 3D | Rôle textures, extraction GLB, dédoublonnage |
| **05** | [Icônes .anim.json et .input.json](05-icones-json-animations-controles.md) | Lot 2 — Documents | Types de documents & migration automatique |
| **06** | [Menu Asset du clic droit](06-menu-asset-clic-droit.md) | Lot 1 — Nettoyage | Masquage sur dossier, libellé dynamique |
| **07** | [Atmosphere_Module](07-atmosphere-module.md) | Lot 6 / Moteur C | Ciel physique Rayleigh/Mie, soleil, brouillard |
| **08** | [Modules de scène](08-modules-scene.md) | Lot 6 — Scène | Architecture familles & catalogue de modules |
| **09** | [Outil Relief](09-outil-relief.md) | Lot 5 — Terrain | Prévisualisation verte, grille, brosses |
| **10** | [Panneaux Maillage et Lumière](10-panneaux-maillage-lumiere.md) | Lot 1 — Nettoyage | Filtre dans Scène, suppression d'outils |
| **11** | [Moteur Compatible & Avancé](11-moteur-rendu-compatible-avance.md) | Socle Moteur | Pilotes RenderDriver, WebGL/WebGPU, Hot Switch |
| **12** | [Export Electron & Web](12-export-application-electron-et-web.md) | Socle Distribution | Multi-cibles, Brotli 11, PBR lossless |
| **13** | [Banc Synchronisé GPU & Golden Stills](13-banc-baseline-gpu-golden-stills.md) | Moteur Lot A | 3 portes (Visuelle, Établi, Froid→Chaud) & Courbe S0–S5 |
| **14** | [Nœuds TSL Immédiats](14-tsl-immediat-ssgi-ssr-taau.md) | Moteur Lot B1 | SSGI, SSR, Godrays, Denoise, TAAU/FSR1 & Test |
| **15** | [Extensions Architecturales TSL](15-tsl-mrt-elargi-sss-lumiere.md) | Moteur Lot B2 | MRT Élargi (materialRoughness/Metalness), SSS |
| **16** | [LODs Automatiques en Worker](16-lods-automatiques-meshoptimizer-worker.md) | Moteur Lot D1 | Décimation `meshoptimizer` & Screen-Space Error |
| **17** | [Transcodage Textures KTX2](17-encodage-textures-ktx2-basis.md) | Moteur Lot D2 | Instruction WASM prioritaire / `basisu` en tâche de fond |
| **18** | [Runtime Export WebGPU](18-runtime-export-webgpu.md) | Moteur Lot F | `policy.engine` dans `webRender.ts:359` & déduplication |

---

## Les Trois Portes Indépendantes du Lot A (Spec 13)

| Porte | Mesure | Ce qu'elle attrape |
|---|---|---|
| **Visuelle** | Golden still, écart quadratique moyen (RMS) | Dérive de pixels, régressions d'affichage |
| **Régime établi** | `stillMs`, `gpuFrameMs`, budget par poste, P95/P99 | Passe trop chère, saturation GPU, micro-stutter |
| **Froid → chaud** | `firstStillMs − stillMs`, seuil explicite | Stall de compilation de pipeline WebGPU |

---

## Courbe de Charge et Détection de Coude (Spec 13)

Au lieu d'un benchmark unique confortable, le banc exécute la suite paramétrée :
- **S0** : Baseline minimale
- **S1** : 500 objets instanciés
- **S2** : 1 000 objets instanciés
- **S3** : 2 000 objets uniques (stress CPU soumission)
- **S4** : 30 lumières dynamiques (stress passes GPU)
- **S5** : Hostile (cumul géométrie, lumières, ombres)

Relevé systématique : `CPU frame`, `GPU frame`, `submitMs`, `P95`, `P99`, `firstStillMs − stillMs`.
- *Dégradation linéaire* $\rightarrow$ goulet GPU $\rightarrow$ optimisation ciblée des passes.
- *Marche d'escalier* $\rightarrow$ saturation soumission CPU $\rightarrow$ décision ciblée.

---

## Watchlist Conditionnelle (Déclenchée uniquement sur preuve)

Ces chantiers ne sont ni rejetés ni planifiés : ils restent en veille et ne sont ouverts que si un seuil de déclenchement est franchi au banc du Lot A :

| Sujet | Déclencheur qui le rouvrirait |
|---|---|
| **Rendu final path tracé progressif** | Décision de valeur produit (export film/images de référence), pas de performance brute |
| **GPU-driven rendering, Hi-Z, Meshlets** | Coude CPU avéré sur S3/S5, gain chiffré supérieur au coût du fork Three.js |
| **Render Graph & Transient Aliasing** | Allocations de cibles avérées dominantes dans la bande passante |
| **Streaming de textures, Mip residency** | Dépassement avéré du budget VRAM sur projet réel |
| **Résolution dynamique (DRS)** | Après Lot B1, si le temps de frame devient instable en cours d'interaction |
| **Radiance Cascades 3D** | Maturité industrielle en 3D sur le Web |
| **Animation / Simulation LOD, Monde 100 km²** | Hors cible actuelle de l'atelier |
| **Gaussian Splatting (3DGS)** | Un provider IA du studio en génère $\rightarrow$ format en lecture seule |

---

## Ordre d'Exécution

```text
Lot A (Spec 13) ── Courbe S0-S5 + Trois Portes
  │
  ├── Plafond non atteint ──→ B1 (Spec 14) ──→ C (Spec 07), D1 (Spec 16), D2 (Spec 17), B2 (Spec 15), F (Spec 18)
  │
  └── Plafond atteint ──────→ Profiler le goulot spécifique
                                ├── Soumission CPU ──→ Action minimale chiffrée
                                └── GPU / VRAM ──────→ Action minimale chiffrée
```

---

## Arborescence & Modules R&D (`render-tech-lab`)

Chaque technique est isolée et testée selon le protocole de décision chiffrée :
$$\text{Hypothèse} \rightarrow \text{Prototype} \rightarrow \text{Benchmark} \rightarrow \text{Profiling} \rightarrow \text{Gain} \rightarrow \text{Coût} \rightarrow \text{Décision}$$

| Module | Objet de recherche | Protocole |
|---|---|---|
| [**00-baseline**](00-baseline/README.md) | Socle WebGPU/TSL de référence (Courbe S0–S5, Golden Stills) | [hypothesis.md](00-baseline/hypothesis.md) |
| [**01-gpu-driven**](01-gpu-driven/README.md) | GPU-Driven Rendering, Frustum & Hi-Z Culling (Compute / Indirect Draw) | [hypothesis.md](01-gpu-driven/hypothesis.md) |
| [**02-nanite-inspired**](02-nanite-inspired/README.md) | Virtualized Geometry, Meshlets & Cluster Culling | [hypothesis.md](02-nanite-inspired/hypothesis.md) |
| [**03-virtual-shadow-maps**](03-virtual-shadow-maps/README.md) | Virtual Shadow Maps (VSM) & Atlas paginé | [hypothesis.md](03-virtual-shadow-maps/hypothesis.md) |
| [**04-lumen-inspired**](04-lumen-inspired/README.md) | Dynamic Global Illumination (SSGI TSL, Radiance Cascades) | [hypothesis.md](04-lumen-inspired/hypothesis.md) |
| [**05-tsr**](05-tsr/README.md) | Temporal Super Resolution (TSR / TAAU) & Upscaling | [hypothesis.md](05-tsr/hypothesis.md) |
| [**06-virtual-textures**](06-virtual-textures/README.md) | Sparse Virtual Texturing (SVT) & Mip Streaming | [hypothesis.md](06-virtual-textures/hypothesis.md) |
| [**07-render-graph**](07-render-graph/README.md) | Render Graph & Transient Resource Aliasing | [hypothesis.md](07-render-graph/hypothesis.md) |

### Bancs transversaux et rapports
- [**benchmarks/**](benchmarks/README.md) : Métriques unifiées ([`cpu`](benchmarks/cpu), [`gpu`](benchmarks/gpu), [`memory`](benchmarks/memory), [`image-quality`](benchmarks/image-quality)).
- [**reports/**](reports/README.md) : Rapports d'arbitrage consolidés et décisions de fusion.

