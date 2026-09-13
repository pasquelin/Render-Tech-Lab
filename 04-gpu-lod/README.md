# 04 · GPU LOD & Screen-Space Error

**Périmètre :** Niveaux de Détail (LOD) & Sélection Dynamique par Screen-Space Error (SSE)  
**Spécification d'ingénierie :** Spécification 16 & Master Test Plan  
**Statut contractuel :** `not-yet-decided` — 04A/04B ont des chemins CPU/WASM exécutables ; 04C exige une campagne GPU instrumentée.

> **Règle gouvernante du laboratoire :**  
> *« Aucune infrastructure majeure n'est adoptée sans qu'un banc démontre que l'architecture actuelle est le facteur limitant. »*

---

## 1. Décomposition Scientifique Tripartite

Pour ne pas mélanger le coût de fabrication géométrique et le coût d'évaluation dynamique, ce banc isole rigoureusement 3 sous-systèmes :

```text
04-gpu-lod
│
├── 04A — Génération LOD (meshoptimizer)
│      Web Worker dédié (hors UI thread)
│      Transfert mémoire sans copie (Transferable ArrayBuffer)
│      Génération LOD 0 (100%), LOD 1 (50%), LOD 2 (25%)
│
├── 04B — Sélection Screen-Space Error (CPU)
│      Fonction mathématique pure et testable
│      Boucle CPU légère par instance
│
└── 04C — Sélection Screen-Space Error (GPU)
       Compute Shader WGSL évaluant l'erreur projetée
       Sélection directe en VRAM sans aller-retour CPU
```

---

## 2. Formulation Mathématique Pure du Screen-Space Error (SSE)

$$\text{pixels} = \frac{D \times H}{2d \tan(\text{FOV} / 2)}$$

- $D$ : Diamètre englobant de l'objet (monde).
- $H$ : Hauteur du viewport (pixels).
- $d$ : Distance euclidienne objet-caméra.
- $\text{FOV}$ : Champ de vision vertical (radians).

### Paliers de Bascule & Tolérance
- $\text{pixels} > 250\text{ px} \implies \text{LOD 0}$
- $60\text{ px} < \text{pixels} \le 250\text{ px} \implies \text{LOD 1}$
- $\text{pixels} \le 60\text{ px} \implies \text{LOD 2}$
- **Seuil d'erreur géométrique projetée :** $\le 1,5\text{ pixel}$ (contrôlé unitairement).

---

## 3. État réellement démontré

- **04A :** génération meshoptimizer réelle ; ses temps dépendent d'une exécution CPU/WASM et ne prouvent pas le coût d'une frame.
- **04B :** sélection SSE CPU réelle et couverte par un oracle différentiel déterministe.
- **04C :** shader et renderer natif présents, mais aucun gain GPU ne doit être annoncé sans timestamps et campagne comparative valide.
- **Décision :** suspendue jusqu'à une mesure physique traçable et une correctness gate visuelle.

Après une exécution, le rapport complet se trouve dans `reports/04-gpu-lod-comparison/campaign-<id>/REPORT.md` avec ses objets compressés, journaux et comparaisons visuelles.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
