# 02-gpu-frustum-culling — campagne intégrée

Date : 2026-09-12T15:20:47.019Z.
Statut : measured.
Contrôle : Readback physique conforme avant et après chaque variante.
Exécution : runner physique WebGPU.

| Stratégie | CPU (ms) | GPU (ms) | Éléments traités |
|---|---:|---:|---:|
| atomic | 0.033 | 0.830 | 10000 |
| workgroup | 0.033 | 0.425 | 10000 |

La durée de présentation de l’interface est exclue.
