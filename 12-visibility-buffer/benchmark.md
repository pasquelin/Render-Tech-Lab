# 12-visibility-buffer — Benchmark

**Question gouvernante :** Le découplage strict entre calcul de visibilité et shading différé apporte-t-il un gain net sur WebGPU face aux scènes denses ?

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté. Aucune valeur n'est mesurée.

## 1. Architecture à deux passes (Master Test Plan §7-12)

```text
Pass 1 — Visibilité
   ├─► écriture compacte 32-bit (primitiveId + materialId + depth)
   └─► buffer de visibilité (viewport-sized)

       │
       ▼

Pass 2 — Shading différé
   ├─► reconstruction d'attributs pour les pixels visibles seulement
   ├─► évaluation du matériau uniquement pour ces pixels
   └─► 0 overdraw de shading
```

## 2. Paliers (nombre d'objets)

| Palier | Objets |
|---|---|
| V-100 | 100 |
| V-1k  | 1 000 |
| V-10k | 10 000 |
| V-100k | 100 000 |

## 3. Métriques obligatoires (Master Test Plan §7-12)

| Métrique | Définition |
|---|---|
| `primitiveIdBufferBytes` | Taille du buffer d'IDs primitive |
| `materialIdBufferBytes` | Taille du buffer d'IDs matériau |
| `depthBufferBytes` | Taille du buffer de profondeur |
| `shadingCostMs` | Coût de shading (pass 2) |
| `overdrawAvoided` | Overdraw de shading évité (vs. forward) |
| `forwardBufferBytes` | Bande passante du G-buffer (forward) |
| `deferredBufferBytes` | Bande passante du Visibility-buffer (deferred) |
| `materialLookupMs` | Coût de lookup des matériaux |

## 4. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | `shadingCostMs + overhead (buffers) < forwardCost` et `overdrawAvoided > 30 %` |
| `REJECT` | `shadingCostMs > forwardCost` sur 2 des 4 paliers |
| `WATCHLIST` | Net positif seulement aux paliers élevés (V-10k+) |

## 5. Non-fait volontairement

- G-buffer complet (normal, position, material) : le banc écrit uniquement IDs + depth (pass 1), pas le G-buffer.
- Forward + deferred en mode hybride (pas de mix) : la comparaison est stricte.
- Multi-sample : non couvert.
