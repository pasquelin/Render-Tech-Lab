# 02-gpu-frustum-culling — GPU Frustum Culling Compute WGSL

## 1. Question Gouvernante
> *Quel gain apporte l'externalisation du test d'intersection plan/sphère sur Compute Shader WGSL par rapport à la boucle CPU récursive Three.js ?*

---

## 2. Statut & Décision R&D
- **Décision contractuelle :** `INTEGRATE` (Validé)
- **Résultat étalon :** −92,7% de temps de soumission CPU à 2 000 objets uniques ($0,25\text{ ms}$ vs $3,35\text{ ms}$).
- **Crossover point :** Rentable dès $1\,000$ objets.

---

## 3. Architecture Technique
```text
ObjectBuffer (Instances VRAM)
       │
       ▼
Compute Shader WGSL (Test plans de frustum / sphère englobante)
       │
       ├── Hors frustum ──► Rejet (0 écriture)
       │
       └── Dans frustum ──► atomicAdd(drawIndirect.instanceCount, 1)
                               │
                               ▼
                    drawIndexedIndirect (1 draw call)
```

---

## 4. Composants
- `implementation/` : Shader WGSL de culling et binding WebGPU.
- `benchmark/` : Profilage comparatif avec CPU frustum culling Three.js.
- `results/` : Métriques brutes standardisées `latest.json` et rapport `REPORT.md`.
