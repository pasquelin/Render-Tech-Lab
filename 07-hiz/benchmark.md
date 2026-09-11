# 07-hiz — Benchmark

**Question gouvernante :** Quel est le coût matériel net (GPU ms et bande passante VRAM) de la construction hiérarchique d'un tampon de profondeur sous WebGPU ?

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté. Aucune valeur n'est mesurée.

## 1. Chaine de génération (contractuelle)

```text
depth (buffer de profondeur, full-res)
   │
   ▼
mip 0  (max 2x2)   ──►  mip 1  ──►  mip 2  ──►  ...  ──►  Hi-Z pyramid (1x1)
```

Chaque niveau applique `max(depth[i00], depth[i01], depth[i10], depth[i11])` sur un bloc 2×2. Récursif jusqu'au mip de 1×1.

## 2. Paliers de résolution

| Palier | Taille | Mips attendus |
|---|---|---|
| R-512  | 512 × 512   | 10 |
| R-1024 | 1024 × 1024 | 11 |
| R-2048 | 2048 × 2048 | 12 |

## 3. Scénarios de référence

```text
input       : buffer de profondeur pleine résolution (fixture 07)
baseline    : génération séquentielle CPU (référence non-optimisée)
prototype   : NON IMPLÉMENTÉ — compute WGSL downsampling 2x2
mesure      : générationMs, perMipMs, totalBytes, bandwidth
```

## 4. Métriques obligatoires (Master Test Plan §7-07)

| Métrique | Définition |
|---|---|
| `generationMs` | Temps total (tous mips combinés) |
| `perMipMs[level]` | Temps individuel par niveau |
| `totalBytes` | Mémoire de la pyramide |
| `bandwidth` | Volume de données écrites par la pyramide (proxy de bande passante) |

## 5. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | Coût net < bénéfice démontré par le banc 08 (occlusion) |
| `REJECT` | `generationMs` > `budget` du banc 08 et gain net négatif |
| `WATCHLIST` | WebGPU ne supporte pas `textureStore` sur la résolution cible |

## 6. Non-fait volontairement

- Hi-Z adaptatif (résolution dynamique par scène).
- Pyramide à plusieurs formats (R32, R16, R8) : le banc doit choisir un format canonique, pas les tester tous.
- Intégration avec 08 (occlusion) : le banc 07 mesure le surcoût, le banc 08 mesure le gain.
