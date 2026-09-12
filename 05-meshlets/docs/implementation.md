# 05-meshlets — Implémentation

**Statut :** `not-implemented` — ce document décrit le plan d'implémentation attendu, pas un état livré.

> L'agent s'engage à ne jamais marquer ce banc « validé » tant qu'aucun benchmark réel n'a été effectivement exécuté (règle absolue 6). Aucun chiffre de ce plan n'est une mesure.

## 1. Périmètre minimal

- Consommation de la fixture `shared/fixtures/sphere.ts` comme invariant géométrique (`test_meshlets.ts`).
- Consommation du runner canonique `shared/benchmark/runner.ts` pour enregistrer `not-run` / `measured` sans inventer.
- Consommation des types `05-meshlets/contracts.ts` comme contrat de métadonnées partagées (05, 06, 07, 13).

## 2. Architecture prévue

```text
fixture maillage (positions + indices)
        │
        ▼
[05A] Partitionneur CPU — NON IMPLÉMENTÉ
      - Paliers 64 / 128 / 256 / 512
      - Mesure : buildTimeMs, duplication, mémoire, métadonnées
        │
        ▼
[05B] Buffer de métadonnées GPU — NON IMPLÉMENTÉ
      - Struct Meshlet WGSL (voir types.ts)
      - Upload de la liste de meshlets
```

## 3. Non-fait volontairement

- Partitionneur (05A) : aucun choix d'algorithme n'est imposé ; le banc doit seulement produire les quatre métriques obligatoires du Master Test Plan.
- Buffer GPU (05B) : réservé à l'implémentation.
- Pas de hiérarchie : aucun arbre de clusters — c'est un banc unitaire, pas un pipeline.

## 4. Livrables attendus avant qu'on puisse exécuter ce banc

| Livrable | État |
|---|---|
| `05-meshlets/contracts.ts` | ✅ Présent |
| `05-meshlets/docs/protocol.md` (contrat) | ✅ Présent |
| `05-meshlets/runner/index.ts` | ❌ À créer lors de l'implémentation |
| `05-meshlets/baseline/classicPartition.ts` | ❌ À créer |
| `05-meshlets/implementation/meshletPartitioner.ts` | ❌ À créer |
| `05-meshlets/results/latest.json` | ✅ Squelette `not-run` |
| `05-meshlets/results/REPORT.md` | ✅ Squelette `not-run` |
