# 01-indirect-draw — Comparaison système

Date : 2026-09-12T14:50:42.760Z. Navigateur : Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36. GPU : identité non capturée.
Verdict : not-yet-decided.
Comparaison système WebGL/Three.js contre WebGPU natif. Aucun crossover algorithmique ni verdict automatique ; GPU mesuré uniquement si timestamp-query disponible.

Protocole : 4 paliers × 2 backends = 8 lignes ; ordre alterné CPU/GPU puis GPU/CPU ; 60 frames d’échauffement + 128 frames mesurées par bloc ; résolution du canvas enregistrée par la campagne hôte.

| Mode | Objets | Échantillons | CPU (ms) | Encodage + soumission CPU (ms) | Enveloppe GPU compute→raster (ms) | FPS rAF | P95 CPU | P99 CPU | Draws |
|---|---|---|---|---|---|---|---|---|---|
| classic | 500 | 128 | 0.906 | 0.905 | non mesuré | 120.00 | 1.200 | 1.400 | 240 |
| classic | 1000 | 128 | 1.588 | 1.587 | non mesuré | 119.98 | 2.100 | 2.200 | 501 |
| classic | 2000 | 128 | 1.868 | 1.865 | non mesuré | 119.98 | 3.700 | 3.800 | 1013 |
| classic | 5000 | 128 | 3.277 | 3.276 | non mesuré | 120.11 | 3.800 | 4.000 | 2437 |
| gpu-driven | 500 | 128 | 0.169 | 0.139 | 0.459 | 120.00 | 0.300 | 0.300 | 1 |
| gpu-driven | 1000 | 128 | 0.167 | 0.128 | 0.771 | 119.89 | 0.200 | 0.300 | 1 |
| gpu-driven | 2000 | 128 | 0.157 | 0.127 | 0.573 | 119.99 | 0.200 | 0.300 | 1 |
| gpu-driven | 5000 | 128 | 0.171 | 0.139 | 0.833 | 120.02 | 0.200 | 0.300 | 1 |

Le temps GPU couvre reset/culling/raster ; les uploads et la présentation ne sont pas inclus.
Les FPS ne sont pas déduits du temps CPU. Les backends et matériaux diffèrent : aucune parité visuelle ni accélération isolée n'est déduite de cette comparaison.
