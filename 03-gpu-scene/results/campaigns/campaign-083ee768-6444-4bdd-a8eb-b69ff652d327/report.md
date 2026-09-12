# Bench Report: 03-gpu-scene

**Technique under test:** Heterogeneous GPU Scene (`ObjectBuffer`, `GeometryBuffer`, `MaterialBuffer`, Multi-Draw Indirect)  
**Bench last updated:** 2026-09-12 14:53:41 UTC  
**Environment:** Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36

> **Governing rule:** every figure below is produced by the in-app harness. Cells marked `n/a` are not instrumented and are deliberately left unmeasured rather than estimated.

---

## 1. Matrice de stress — mesures A/B

| Scénario | Objets | Topologies | Matériaux | Submit Test A | Submit Test B | Speed-up | Frame A | Frame B | Draw calls A | Draw calls B |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Dim A : 1 topologie | 2000 | 1 | 10 | 0.910 ms | 0.130 ms | 7.0× | 0.930 ms | 0.190 ms | 699 | 1 |
| Dim A : 10 topologies | 2000 | 10 | 10 | 1.017 ms | 0.117 ms | 8.7× | 1.037 ms | 0.173 ms | 697 | 10 |
| Dim A : 50 topologies | 2000 | 50 | 10 | 1.093 ms | 0.100 ms | 10.9× | 1.100 ms | 0.137 ms | 697 | 50 |
| Dim A : 100 topologies | 2000 | 100 | 10 | 1.190 ms | 0.080 ms | 14.9× | 1.223 ms | 0.120 ms | 696 | 100 |
| Dim B : 1 matériau | 2000 | 10 | 1 | 1.470 ms | 0.133 ms | 11.0× | 1.483 ms | 0.180 ms | 697 | 10 |
| Dim B : 10 matériaux | 2000 | 10 | 10 | 1.230 ms | 0.130 ms | 9.5× | 1.263 ms | 0.190 ms | 697 | 10 |
| Dim B : 50 matériaux | 2000 | 10 | 50 | 1.707 ms | 0.140 ms | 12.2× | 1.727 ms | 0.193 ms | 697 | 10 |
| Dim B : 100 matériaux | 2000 | 10 | 100 | 1.380 ms | 0.103 ms | 13.4× | 1.407 ms | 0.167 ms | 697 | 10 |
| Dim C : 0% dynamique | 2000 | 10 | 10 | 1.480 ms | 0.127 ms | 11.7× | 1.497 ms | 0.160 ms | 697 | 10 |
| Dim C : 25% dynamique | 2000 | 10 | 10 | 1.323 ms | 0.123 ms | 10.7× | 1.503 ms | 0.560 ms | 694 | 10 |
| Dim C : 50% dynamique | 2000 | 10 | 10 | 1.190 ms | 0.123 ms | 9.6× | 1.460 ms | 0.850 ms | 695 | 10 |
| Dim C : 100% dynamique | 2000 | 10 | 10 | 1.220 ms | 0.093 ms | 13.1× | 1.717 ms | 1.390 ms | 693 | 10 |

## 2. Culling GPU et empreinte VRAM (Test B)

| Scénario | Objets visibles | Objets culled | VRAM tampons de scène | GPU Test B | GPU Test B |
|---|---:|---:|---:|---:|
| Dim A : 1 topologie | 703 | 1 297 | 0.19 Mo | 0.878 ms |
| Dim A : 10 topologies | 697 | 1 303 | 0.21 Mo | 0.467 ms |
| Dim A : 50 topologies | 698 | 1 302 | 0.30 Mo | 0.845 ms |
| Dim A : 100 topologies | 698 | 1 302 | 0.42 Mo | 1.169 ms |
| Dim B : 1 matériau | 697 | 1 303 | 0.21 Mo | 0.859 ms |
| Dim B : 10 matériaux | 697 | 1 303 | 0.21 Mo | 0.955 ms |
| Dim B : 50 matériaux | 697 | 1 303 | 0.21 Mo | 0.968 ms |
| Dim B : 100 matériaux | 697 | 1 303 | 0.21 Mo | 0.955 ms |
| Dim C : 0% dynamique | 697 | 1 303 | 0.21 Mo | 0.865 ms |
| Dim C : 25% dynamique | 696 | 1 304 | 0.21 Mo | 1.062 ms |
| Dim C : 50% dynamique | 697 | 1 303 | 0.21 Mo | 1.029 ms |
| Dim C : 100% dynamique | 693 | 1 307 | 0.21 Mo | 1.114 ms |

## 3. Protocole

- 10 frames de warmup puis 30 frames échantillonnées par mode et par scénario.
- Test A et Test B suivent le même protocole, sur la même instance de navigateur, le même GPU et la même résolution de canvas.
- La boucle d'animation est neutralisée pendant la campagne pour ne pas soumettre de frames non mesurées.
- Disposition de scène déterministe (générateur à graine fixe), donc rejouable à l'identique.
- GPU Test B mesure par timestamp-query l’enveloppe compute/raster quand disponible ; les autres colonnes de temps mesurent le CPU. Les moteurs WebGL et WebGPU diffèrent : aucun gain algorithmique isolé n’est déduit.
