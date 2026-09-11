# 03-virtual-shadow-maps — Virtual Shadow Maps (VSM)

## Description
Gestion paginée d'atlas d'ombres virtuelles pour éliminer les artefacts de cascades et offrir des ombres nettes sur de grandes étendues avec géométrie dense.

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
