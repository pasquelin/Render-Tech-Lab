# 08-occlusion-culling — Benchmark

**Question gouvernante :** À partir de quel seuil d'occlusion le culling Hi-Z compense-t-il son propre surcoût de génération et de test ?

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté. Aucune valeur n'est mesurée.

## 1. Équation contractuelle de gain net (Master Test Plan §7-08)

```text
Gain_net = Coût_baseline − (Coût_HiZ + Coût_culling + Coût_raster_résiduel)
```

Chaque terme est mesuré par un banc distinct :
- `Coût_baseline` : banc 00 (référent)
- `Coût_HiZ` : banc 07 (génération de la pyramide)
- `Coût_culling` : banc 08 (test d'occlusion par meshlet)
- `Coût_raster_résiduel` : banc 08 (rasterisation des meshlets non-occlus)

## 2. Paliers de charge (seuils d'occlusion)

| Palier | % d'occlusion attendue |
|---|---|
| O-10  | 10 % |
| O-25  | 25 % |
| O-50  | 50 % |
| O-75  | 75 % |
| O-90  | 90 % |
| O-99  | 99 % |

## 3. Scénarios de référence

```text
fixtures : scene à N meshlets (réutilisant 05-meshlets/contracts.ts)
baseline   : 00-baseline (S3, S5)
prototype  : NON IMPLÉMENTÉ — frustum + Hi-Z + sub-pixel
```

## 4. Métriques obligatoires (Master Test Plan §7-08)

| Métrique | Définition |
|---|---|
| `objectsTotal` | Nombre de meshlets soumis |
| `objectsVisible` | Nombre de meshlets rendus |
| `objectsOccluded` | Nombre de meshlets rejetés (Hi-Z) |
| `trianglesRejected` | Σ triangleCount des occlus |
| `meshletsRejected` | Nombre de meshlets rejetés |
| `hiZGenerationMs` | Mesure banc 07 (référence) |
| `cullingMs` | Mesure sur ce banc |
| `gainNet` | Équation ci-dessus |

## 5. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | `gainNet > 0` et stable entre paliers (pas de dégradation > 2×) |
| `REJECT`    | `gainNet <= 0` sur plus de la moitié des paliers |
| `WATCHLIST` | Gain positif seulement aux paliers élevés (75 %+) : technique utile mais coûteuse |

## 6. Non-fait volontairement

- Hi-Z adaptatif / dynamique : la pyramide est pleine, pas élaguée.
- Occlusion par pixel : le banc est à l'échelle du meshlet, pas du pixel.
- Multi-GPU / partitionnement : non couvert.
- Combinaison avec le banc 09 (compaction) : le banc 09 est indépendant.
