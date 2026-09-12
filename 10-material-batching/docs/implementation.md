# 10-material-batching — Implementation

**Statut :** plan de soumission, table compacte, campagne bornée et gate d'équivalence implémentés. Backend WebGPU physique non branché au runner commun.

## 1. Périmètre

- 4 stratégies à comparer (sans préjuger) :
  - **A** `state-switch`, **B** `storage-buffer`, **C** `texture-array`, **D** `pseudo-bindless`.

## 2. Architecture prévue (NON IMPLÉMENTÉE)

```text
materialCount = N
        │
        ▼
[10A] state-switch    ─┐
[10B] storage-buffer  ─┼─►  BatchingOutput  (cpuFrameMs, gpuFrameMs, bindGroup changes…)
[10C] texture-array   ─┤
[10D] pseudo-bindless ─┘  (optionnel : si WebGPU non-interopérable, WATCHLIST)
```

## 3. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | Stratégie la moins coûteuse sur 3 des 5 paliers, sans régression > 2× |
| `REJECT`    | Stratégie systématiquement la plus lente sur 4 paliers |
| `WATCHLIST` | Gagnante seulement aux paliers élevés (M-1k+) |

## 4. Non-fait volontairement

- `pseudo-bindless` natif : pas imposé.
- Shading différé : banc 12.
- Compteur d'échantillons par pixel : non requis.
