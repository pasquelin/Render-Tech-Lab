# Protocole de Benchmark : 04-gpu-lod

**Périmètre :** Protocole expérimental reproductible pour le banc des niveaux de détail (LOD).

---

## 1. Protocole de Mesure des 3 Sous-Bancs

### 04A : Génération Asynchrone
- **Scène source :** Sphère dense subdivisée à 64 segments (8 000 triangles, 4 141 sommets).
- **Opération :** Décimation via `MeshoptSimplifier.simplify` vers les ratios $50\%$ (LOD1) et $25\%$ (LOD2).
- **Mesure :** Durée pure du worker en millisecondes et conservation topologique.

### 04B : Sélection Screen-Space Error CPU
- **Paliers de charge :** $1\,000$, $2\,000$ (S3), $5\,000$, $10\,000$, $50\,000$ instances.
- **Protocole :** 3 passes de warmup + 10 passes d'échantillonnage moyennées.
- **Paramètres caméra :** FOV 60°, résolution $1920 \times 1080$, trajectoire fixe.

### 04C : Sélection Screen-Space Error GPU
- **Pipeline :** Compute Shader WGSL exécuté sur WebGPU.
- **Mesure :** Temps GPU du compute dispatch et contention mémoire sur les compteurs atomiques.

---

## 2. Commandes de Reproductibilité

Exécution des tests unitaires mathématiques :
```bash
pnpm test
```

Exécution de la campagne complète 04A/B/C avec archivage automatique :
```bash
pnpm run bench:lod
```

---

## 3. Conformité Standard Benchmark Contract

Les données brutes sont automatiquement écrites dans [`results/latest.json`](../results/latest.json) selon la structure.
