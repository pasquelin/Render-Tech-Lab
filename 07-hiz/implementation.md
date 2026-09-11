# 07-hiz — Implementation

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté. Ce document décrit uniquement le plan d'implémentation.

## 1. Périmètre

- Consomme le buffer de profondeur plein-résolution (Test A : `three.js` standard, Test B : `render target` WebGPU).
- Produit la pyramide `mip 0 → mip N` via un compute shader (2×2 downsampling conservateur : `max`).

## 2. Architecture prévue (NON IMPLÉMENTÉE)

```text
depth (full-res, GPU render target)
        │
        ▼
[07A] generateHiZPyramid (WGSL)
        ├─► mip 0  =  full-res   (lecture directe, pas de copy nécessaire)
        ├─► mip 1  =  max 2x2 (mip0)
        ├─► mip 2  =  max 2x2 (mip1)
        └─► ...  mip N = 1x1
        │
        ▼
HiZ pyramid (GPU texture) + HiZCost
```

## 3. Paliers

| Palier | Taille | Mips |
|---|---|---|
| R-512  | 512 × 512   | 10 |
| R-1024 | 1024 × 1024 | 11 |
| R-2048 | 2048 × 2048 | 12 |

## 4. Métriques obligatoires (Master Test Plan §7-07)

- `generationMs` : coût total de la pyramide
- `perMipMs[level]` : individuel
- `totalBytes` : mémoire totale
- `bandwidth` : proxy de bande passante

## 5. Non-fait volontairement

- Hi-Z adaptatif / dynamique : la pyramide est pleine, pas élaguée.
- Format multi-bits (R32, R16, R8) : le banc choisit un format canonique, pas les tester tous.
- Occlusion (test de frustum + Hi-Z + sub-pixel) : banc 08 uniquement.

## 6. Livrables attendus avant exécution

| Livrable | État |
|---|---|
| `07-hiz/types.ts` | ✅ Présent |
| `07-hiz/benchmark.md` | ✅ Présent |
| `07-hiz/baseline/cpuPyramid.ts` | ❌ À créer |
| `07-hiz/implementation/hiZGenerate.wgsl.ts` | ❌ À créer |
| `07-hiz/results/latest.json` | ✅ Squelette `not-run` |
