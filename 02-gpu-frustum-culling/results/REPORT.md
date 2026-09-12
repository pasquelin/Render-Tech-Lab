# 02-gpu-frustum-culling — campagne intégrée

Date : 2026-09-12T15:20:52.249Z.
Statut : measured.
Contrôle : Readback physique conforme avant et après chaque variante.
Exécution : runner physique WebGPU.

| Stratégie | CPU (ms) | GPU (ms) | Éléments traités |
|---|---:|---:|---:|
| atomic | 0.000 | 0.214 | 2000 |
| workgroup | 0.033 | 0.295 | 2000 |

La durée de présentation de l’interface est exclue.
