# 02-gpu-frustum-culling — campagne intégrée

Date : 2026-09-12T15:20:44.406Z.
Statut : measured.
Contrôle : Readback physique conforme avant et après chaque variante.
Exécution : runner physique WebGPU.

| Stratégie | CPU (ms) | GPU (ms) | Éléments traités |
|---|---:|---:|---:|
| atomic | 0.033 | 1.839 | 5000 |
| workgroup | 0.067 | 0.395 | 5000 |

La durée de présentation de l’interface est exclue.
