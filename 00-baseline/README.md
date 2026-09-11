# 00-baseline — Socle de Référence (Baseline)

## Description
Banc de référence WebGPU/TSL mesurant les performances du moteur actuel sur les scénarios S0 à S5 (Spec 11, Spec 13).

## Protocole de validation
Chaque étude suit rigoureusement le cycle gouvernant :
$$\text{Hypothèse} \rightarrow \text{Prototype} \rightarrow \text{Benchmark} \rightarrow \text{Profiling} \rightarrow \text{Gain} \rightarrow \text{Coût} \rightarrow \text{Décision}$$

Remplir et maintenir [`hypothesis.md`](hypothesis.md) à chaque étape de l'investigation.

## Structure du module
- `hypothesis.md` : Fiche de cadrage, protocole expérimental, métriques et décision finale.
- `baseline/` : Implémentation ou scène de référence (moteur actuel sans la technique).
- `implementation/` : Prototype expérimental de la nouvelle architecture / passe.
- `benchmark/` : Scripts de test automatisés et scénarios de charge reproductibles.
- `results/` : Traces de capture, métriques chiffrées, graphiques et comparaisons visuelles.
