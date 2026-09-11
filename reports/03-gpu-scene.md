# Bench Report: 02-gpu-scene

**Technique under test:** Heterogeneous GPU Scene (`ObjectBuffer`, `GeometryBuffer`, `MaterialBuffer`, Multi-Draw Indirect)  
**Bench last updated:** 2026-09-11 16:04:15 UTC  
**Environment:** Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36

> **Governing rule:** every figure below is produced by the in-app harness. Cells marked `n/a` are not instrumented and are deliberately left unmeasured rather than estimated.

---

## 1. Matrice de stress — mesures A/B

| Scénario | Objets | Topologies | Matériaux | Submit Test A | Submit Test B | Speed-up | Frame A | Frame B | Draw calls A | Draw calls B |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Dim A : 1 topologie | 2000 | 1 | 10 | 1.497 ms | 0.113 ms | 13.2× | 1.500 ms | 0.157 ms | 856 | 1 |
| Dim A : 10 topologies | 2000 | 10 | 10 | 1.657 ms | 0.157 ms | 10.6× | 1.657 ms | 0.200 ms | 854 | 10 |
| Dim A : 50 topologies | 2000 | 50 | 10 | 1.657 ms | 0.133 ms | 12.4× | 1.660 ms | 0.180 ms | 853 | 50 |
| Dim A : 100 topologies | 2000 | 100 | 10 | 1.583 ms | 0.137 ms | 11.6× | 1.593 ms | 0.187 ms | 853 | 100 |
| Dim B : 1 matériau | 2000 | 10 | 1 | 1.643 ms | 0.150 ms | 11.0× | 1.653 ms | 0.207 ms | 854 | 10 |
| Dim B : 50 matériaux | 2000 | 10 | 50 | 1.707 ms | 0.177 ms | 9.7× | 1.707 ms | 0.227 ms | 854 | 10 |
| Dim B : 100 matériaux | 2000 | 10 | 100 | 2.030 ms | 0.137 ms | 14.9× | 2.037 ms | 0.187 ms | 854 | 10 |
| Dim C : 25% dynamique | 2000 | 10 | 10 | 1.677 ms | 0.160 ms | 10.5× | 1.837 ms | 0.707 ms | 852 | 10 |
| Dim C : 50% dynamique | 2000 | 10 | 10 | 1.547 ms | 0.163 ms | 9.5× | 1.813 ms | 1.200 ms | 853 | 10 |
| Dim C : 100% dynamique | 2000 | 10 | 10 | 1.430 ms | 0.140 ms | 10.2× | 1.890 ms | 1.390 ms | 855 | 10 |

## 2. Culling GPU et empreinte VRAM (Test B)

| Scénario | Objets visibles | Objets culled | VRAM tampons de scène |
|---|---:|---:|---:|
| Dim A : 1 topologie | 645 | 1 355 | 0.19 Mo |
| Dim A : 10 topologies | 712 | 1 288 | 0.21 Mo |
| Dim A : 50 topologies | 655 | 1 345 | 0.30 Mo |
| Dim A : 100 topologies | 654 | 1 346 | 0.42 Mo |
| Dim B : 1 matériau | 653 | 1 347 | 0.21 Mo |
| Dim B : 50 matériaux | 688 | 1 312 | 0.21 Mo |
| Dim B : 100 matériaux | 717 | 1 283 | 0.21 Mo |
| Dim C : 25% dynamique | 709 | 1 291 | 0.21 Mo |
| Dim C : 50% dynamique | 712 | 1 288 | 0.21 Mo |
| Dim C : 100% dynamique | 710 | 1 290 | 0.21 Mo |

## 3. Protocole

- 10 frames de warmup puis 30 frames échantillonnées par mode et par scénario.
- Test A et Test B suivent le même protocole, sur la même instance de navigateur, le même GPU et la même résolution de canvas.
- La boucle d'animation est neutralisée pendant la campagne pour ne pas soumettre de frames non mesurées.
- Disposition de scène déterministe (générateur à graine fixe), donc rejouable à l'identique.
- Le temps GPU n'est pas instrumenté (aucune timestamp query) : les colonnes de temps sont des temps CPU.
