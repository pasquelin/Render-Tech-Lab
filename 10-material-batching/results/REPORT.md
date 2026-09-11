# Rapport de banc — 10-material-batching

> **`Matériaux — state-switch / storage / texture-array / pseudo-bindless`**

**Statut courant :** `not-run`

## Synthèse

Ce banc n'a pas encore été exécuté : **aucune valeur n'est mesurée ou prévue**.

En application de la règle absolue 6 du `MASTER_TEST_PLAN.md`, aucun chiffre n'a
été pré-rempli. La décision finale attend que le banc soit effectivement exécuté
et que ses métriques comparatives (baseline vs. prototype) soient archivées.

## Livrables présents

- `10-material-batching/types.ts` — contrats de type (squelette, aucun algorithme)
- `10-material-batching/benchmark.md` — cahier des charges (paliers, métriques obligatoires, règle d'arbitrage)
- `10-material-batching/implementation.md` — plan d'implémentation (non livré)
- `10-material-batching/results/latest.json` — squelette `not-run` (champs `null` conformément au schéma)

## À faire avant exécution

- Baseline (Test A) : référence Three.js standard comparable
- Prototype (Test B) : implémentation de la technique testée
- Instrumentation : chaque métrique obligatoire du cahier des charges
- Archivage : `results/latest.json` + `results/REPORT.md` remplis avec des mesures réelles

## Décision attendue (rappel)

| Verdict | Condition de déclenchement |
|---|---|
| `INTEGRATE` | Gain net mesuré, régressions sous seuil, stable entre paliers |
| `REJECT`   | Surcoût supérieur au gain sur la moitié des paliers |
| `WATCHLIST` | Gain net seulement aux paliers élevés, ou dépendant de la charge |

---

_Ce rapport est un squelette de gouvernance. Aucune valeur mesurée n'est revendiquée ici.
La décision finale sera remplie dans ce fichier après exécution effective du banc._
