# Benchmarks Centraux

Ce dossier regroupe les bancs de mesure standardisés et réutilisables par l'ensemble des modules d'architecture.

## Catégories de mesure
- `cpu/` : Mesures de charge de soumission CPU, temps d'encodage de commandes, garbage collection et impact multi-threads/workers.
- `gpu/` : Profilage des temps de frame GPU (`timestamp-query`), coût des passes et temps d'exécution des compute shaders.
- `memory/` : Suivi de l'empreinte VRAM, allocations tampons/textures, fuites de mémoire et bande passante.
- `image-quality/` : Validation par écart quadratique moyen (RMS), PSNR, SSIM et comparaison différentielle par rapport aux Golden Stills.

## Scénarios de charge de référence (Courbe S0–S5)
- **S0** : Baseline minimale
- **S1** : 500 objets instanciés
- **S2** : 1 000 objets instanciés
- **S3** : 2 000 objets uniques (stress soumission CPU)
- **S4** : 30 lumières dynamiques (stress passes GPU)
- **S5** : Scénario hostile (cumul géométrie dense, lumières dynamiques, ombres)
