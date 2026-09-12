# Bench Report: 03-gpu-scene

**Technique under test:** Heterogeneous GPU Scene (`ObjectBuffer`, `GeometryBuffer`, `MaterialBuffer`, Multi-Draw Indirect)  
**Bench last updated:** 2026-09-12 15:03:59 UTC  
**Environment:** Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36

> **Governing rule:** every figure below is produced by the in-app harness. Cells marked `n/a` are not instrumented and are deliberately left unmeasured rather than estimated.

---

## 1. Matrice de stress — mesures A/B

| Scénario | Objets | Topologies | Matériaux | Submit Test A | Submit Test B | Speed-up | Frame A | Frame B | Draw calls A | Draw calls B |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Dim A : 1 topologie | 2000 | 1 | 10 | 1.223 ms | 0.110 ms | 11.1× | 1.237 ms | 0.160 ms | 699 | 1 |
| Dim A : 10 topologies | 2000 | 10 | 10 | 1.417 ms | 0.103 ms | 13.7× | 1.433 ms | 0.143 ms | 697 | 10 |
| Dim A : 50 topologies | 2000 | 50 | 10 | 1.387 ms | 0.110 ms | 12.6× | 1.413 ms | 0.143 ms | 697 | 50 |
| Dim A : 100 topologies | 2000 | 100 | 10 | 1.513 ms | 0.157 ms | 9.7× | 1.543 ms | 0.200 ms | 696 | 100 |
| Dim B : 1 matériau | 2000 | 10 | 1 | 1.473 ms | 0.097 ms | 15.2× | 1.490 ms | 0.153 ms | 697 | 10 |
| Dim B : 10 matériaux | 2000 | 10 | 10 | 1.833 ms | 0.130 ms | 14.1× | 1.867 ms | 0.183 ms | 697 | 10 |
| Dim B : 50 matériaux | 2000 | 10 | 50 | 1.723 ms | 0.137 ms | 12.6× | 1.747 ms | 0.187 ms | 697 | 10 |
| Dim B : 100 matériaux | 2000 | 10 | 100 | 1.820 ms | 0.127 ms | 14.4× | 1.857 ms | 0.183 ms | 697 | 10 |
| Dim C : 0% dynamique | 2000 | 10 | 10 | 1.423 ms | 0.140 ms | 10.2× | 1.437 ms | 0.180 ms | 697 | 10 |
| Dim C : 25% dynamique | 2000 | 10 | 10 | 1.250 ms | 0.083 ms | 15.0× | 1.387 ms | 0.453 ms | 694 | 10 |
| Dim C : 50% dynamique | 2000 | 10 | 10 | 1.377 ms | 0.093 ms | 14.7× | 1.637 ms | 0.777 ms | 695 | 10 |
| Dim C : 100% dynamique | 2000 | 10 | 10 | 1.327 ms | 0.107 ms | 12.4× | 1.790 ms | 1.593 ms | 693 | 10 |

## 2. Culling GPU et empreinte VRAM (Test B)

| Scénario | Objets visibles | Objets culled | VRAM tampons de scène | GPU Test B | GPU Test B |
|---|---:|---:|---:|---:|
| Dim A : 1 topologie | 703 | 1 297 | 0.19 Mo | 0.754 ms |
| Dim A : 10 topologies | 697 | 1 303 | 0.21 Mo | 0.367 ms |
| Dim A : 50 topologies | 698 | 1 302 | 0.30 Mo | 0.516 ms |
| Dim A : 100 topologies | 698 | 1 302 | 0.42 Mo | 0.494 ms |
| Dim B : 1 matériau | 697 | 1 303 | 0.21 Mo | 0.485 ms |
| Dim B : 10 matériaux | 697 | 1 303 | 0.21 Mo | 0.546 ms |
| Dim B : 50 matériaux | 697 | 1 303 | 0.21 Mo | 0.354 ms |
| Dim B : 100 matériaux | 697 | 1 303 | 0.21 Mo | 0.422 ms |
| Dim C : 0% dynamique | 697 | 1 303 | 0.21 Mo | 0.376 ms |
| Dim C : 25% dynamique | 696 | 1 304 | 0.21 Mo | 0.603 ms |
| Dim C : 50% dynamique | 697 | 1 303 | 0.21 Mo | 0.358 ms |
| Dim C : 100% dynamique | 693 | 1 307 | 0.21 Mo | 0.319 ms |

## 3. Protocole

- 10 frames de warmup puis 30 frames échantillonnées par mode et par scénario.
- Test A et Test B suivent le même protocole, sur la même instance de navigateur, le même GPU et la même résolution de canvas.
- La boucle d'animation est neutralisée pendant la campagne pour ne pas soumettre de frames non mesurées.
- Disposition de scène déterministe (générateur à graine fixe), donc rejouable à l'identique.
- GPU Test B mesure par timestamp-query l’enveloppe compute/raster quand disponible ; les autres colonnes de temps mesurent le CPU. Les moteurs WebGL et WebGPU diffèrent : aucun gain algorithmique isolé n’est déduit.
