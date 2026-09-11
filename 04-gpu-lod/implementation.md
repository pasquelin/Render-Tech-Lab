# Architecture Technique & Implémentation : 04-gpu-lod

**Périmètre :** Architecture logicielle et structures de données pour les niveaux de détail (LOD) et le Screen-Space Error (SSE).

---

## 1. Vue d'Ensemble de l'Architecture

```text
                  GÉOMÉTRIE SOURCE (Dense)
                             │
                             ▼
         [04A] lodWorker.ts (MeshoptSimplifier)
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
         LOD 1 (50%)                 LOD 2 (25%)
               │                           │
               └─────────────┬─────────────┘
                             ▼
            INSTANCES D'OBJETS DANS LA SCÈNE
                             │
             ┌───────────────┴───────────────┐
             ▼                               ▼
    [04B] cpuLodSelector.ts         [04C] gpuLodShader.ts
     (Boucle CPU analytique)         (Compute Shader WGSL)
             │                               │
             ▼                               ▼
   Mise à jour indices Three.js    DrawBuffer indirect WebGPU
```

---

## 2. 04A — Web Worker de Décimation (`lodWorker.ts`)

- **Bibliothèque :** `meshoptimizer` (`MeshoptSimplifier`).
- **Protocole :** Le thread principal envoie les positions `Float32Array` et les indices `Uint32Array`.
- **Zéro Copie :** La réponse transfère la propriété de la mémoire des indices simplifiés via le deuxième paramètre de `postMessage` :
  ```ts
  postMessage({ type: 'LOD_SUCCESS', result }, [
    result.lods[0].indices.buffer,
    result.lods[1].indices.buffer,
    result.lods[2].indices.buffer,
  ]);
  ```

---

## 3. 04B — Sélecteur Screen-Space Error CPU (`cpuLodSelector.ts`)

- Exploite la fonction pure [**`shared/math/screenSpaceError.ts`**](../shared/math/screenSpaceError.ts).
- Parcours séquentiel des instances avec évaluation de la distance euclidienne $d = \|\mathbf{p} - \mathbf{c}\|$.
- Affectation des seuils :
  - $> 250\text{ px} \implies \text{LOD 0}$
  - $60\text{ px} \text{ à } 250\text{ px} \implies \text{LOD 1}$
  - $\le 60\text{ px} \implies \text{LOD 2}$

---

## 4. 04C — Compute Shader WGSL (`gpuLodShader.ts`)

- **Workgroup Size :** 64 threads (`@workgroup_size(64)`).
- **Buffer Layout :**
  - `@binding(0)` : `CameraUniforms` (position, `screenHeight`, `halfFovTan`, seuils).
  - `@binding(1)` : `ObjectData` (positions, rayons englobants).
  - `@binding(2)` : `LodSelectionResult` (indice de LOD sélectionné, taille projetée en pixels).
  - `@binding(3)` : `LodCounters` (compteurs atomiques par niveau LOD).
- **Mécanique :** Chaque thread traite 1 instance d'objet en parallèle et écrit directement l'indice LOD dans le tampon de sélection sans synchronisation CPU.
