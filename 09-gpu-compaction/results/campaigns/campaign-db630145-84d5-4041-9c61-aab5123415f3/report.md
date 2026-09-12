# 09-gpu-compaction — campagne intégrée

Date : 2026-09-12T15:05:24.912Z.
Statut : measured.
Contrôle : Readback physique conforme avant et après chaque variante.
Exécution : runner physique WebGPU.

| Stratégie | CPU (ms) | GPU (ms) | Éléments traités |
|---|---:|---:|---:|
| serial | 0.033 | 14.942 | 100000 |
| atomic | 0.000 | 0.000 | 100000 |
| workgroup | 0.000 | 0.022 | 100000 |

La durée de présentation de l’interface est exclue.
