# 01-indirect-draw — Comparaison système

Date : 2026-09-12T15:03:18.448Z. Navigateur : Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36. GPU : identité non capturée.
Verdict : not-yet-decided.
Comparaison système WebGL/Three.js contre WebGPU natif. Aucun crossover algorithmique ni verdict automatique ; GPU mesuré uniquement si timestamp-query disponible.

Protocole : 4 paliers × 2 backends = 8 lignes ; ordre alterné CPU/GPU puis GPU/CPU ; 60 frames d’échauffement + 128 frames mesurées par bloc ; résolution du canvas enregistrée par la campagne hôte.

| Mode | Objets | Échantillons | CPU (ms) | Encodage + soumission CPU (ms) | Enveloppe GPU compute→raster (ms) | FPS rAF | P95 CPU | P99 CPU | Draws |
|---|---|---|---|---|---|---|---|---|---|
| classic | 500 | 128 | 0.835 | 0.835 | non mesuré | 119.97 | 1.200 | 1.300 | 240 |
| classic | 1000 | 128 | 1.265 | 1.264 | non mesuré | 119.92 | 2.300 | 2.600 | 501 |
| classic | 2000 | 128 | 2.073 | 2.073 | non mesuré | 119.97 | 3.600 | 4.300 | 1013 |
| classic | 5000 | 128 | 3.018 | 3.018 | non mesuré | 119.86 | 3.700 | 3.800 | 2437 |
| gpu-driven | 500 | 128 | 0.148 | 0.114 | 0.568 | 120.03 | 0.200 | 0.200 | 1 |
| gpu-driven | 1000 | 128 | 0.192 | 0.158 | 0.562 | 119.83 | 0.300 | 0.400 | 1 |
| gpu-driven | 2000 | 128 | 0.209 | 0.163 | 0.622 | 119.94 | 0.300 | 0.600 | 1 |
| gpu-driven | 5000 | 128 | 0.164 | 0.135 | 0.808 | 119.98 | 0.300 | 0.400 | 1 |

Le temps GPU couvre reset/culling/raster ; les uploads et la présentation ne sont pas inclus.
Les FPS ne sont pas déduits du temps CPU. Les backends et matériaux diffèrent : aucune parité visuelle ni accélération isolée n'est déduite de cette comparaison.
