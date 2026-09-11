# 04 · GPU LOD & Screen-Space Error

**Périmètre :** Niveaux de Détail (LOD) & Sélection Dynamique par Screen-Space Error (SSE)  
**Spécification d'ingénierie :** Spécification 16 & Master Test Plan  
**Statut contractuel :** `INTEGRATE` (04A & 04B Validés, 04C Validé pour les scènes denses)

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

## 3. Synthèse des Résultats d'Arbitrage

- **04A Décimation (`meshoptimizer`) :** Réduction géométrique de **−75% de triangles** sur LOD 2, réalisée en **~5 ms** en arrière-plan sans bloquer le rendu.
- **04B vs 04C :** La sélection CPU (04B) est optimale et suffisante jusqu'à 10 000 objets ($< 0.5\,\text{ms}$). À 50 000 objets, le Compute WGSL (04C) s'impose avec une latence stable de **$0.2\,\text{ms}$** ($13\times$ plus rapide).
- **Décision d'arbitrage :** `INTEGRATE` — Adopté pour la chaîne GPU-driven et l'import de modèles denses.

Consultez le rapport complet : [**`results/REPORT.md`**](results/REPORT.md) ou [**`reports/04-gpu-lod.md`**](../reports/04-gpu-lod.md).
