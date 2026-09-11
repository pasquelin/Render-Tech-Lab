# 10-material-batching — Benchmark

**Question gouvernante :** Quelle stratégie de matérialisation minimise réellement le coût CPU / GPU / mémoire sous WebGPU ?

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté. Aucune valeur n'est mesurée.

## 1. Stratégies comparées (sans préjuger)

| ID | Stratégie | Principe |
|---|---|---|
| **A** | `state-switch` | Bascule classique de pipeline / matériaux (référence) |
| **B** | `storage-buffer` | Tampon de stockage de matériaux (uniforms par objet) |
| **C** | `texture-array` | Tableaux de textures (atlas + index) |
| **D** | `pseudo-bindless` | Atlas / indexing dynamique |

> Aucune stratégie n'est imposée. En particulier `pseudo-bindless` doit rester optionnel : si WebGPU ne le supporte pas proprement sur l'environnement cible, le banc l'exclut et l'inscrit en `WATCHLIST`.

## 2. Paliers de charge (nombre de matériaux)

| Palier | Matériaux uniques |
|---|---|
| M-1   | 1 |
| M-10  | 10 |
| M-100 | 100 |
| M-1k  | 1 000 |
| M-10k | 10 000 |

Chaque palier est exécuté par stratégie (4 × 5 = 20 mesures attendues).

## 3. Métriques obligatoires (Master Test Plan §7-10)

| Métrique | Définition |
|---|---|
| `pipelineStateChanges` | Nombre de changements d'état de pipeline |
| `bindGroupChanges` | Nombre de changements de bind group |
| `cpuFrameMs` | Temps CPU par frame |
| `gpuFrameMs` | Temps GPU par frame |
| `materialTableBytes` | Mémoire de la table / storage / atlas |

## 4. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | Stratégie la moins coûteuse sur 3 des 5 paliers, sans régression > 2× sur les autres |
| `REJECT` | Stratégie systématiquement la plus lente sur 4 paliers |
| `WATCHLIST` | Stratégie dépendante de la charge (gagnante seulement à M-1k+) |

## 5. Non-fait volontairement

- `pseudo-bindless` natif : pas imposé si WebGPU ne l'expose pas proprement.
- Shading différé : c'est le banc 12.
- Compteur d'échantillons par pixel : non requis.
