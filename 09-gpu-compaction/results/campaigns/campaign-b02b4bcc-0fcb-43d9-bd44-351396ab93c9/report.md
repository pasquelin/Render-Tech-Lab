# 09-gpu-compaction — campagne intégrée

Date : 2026-09-12T14:11:25.545Z.
Statut : measured.
Contrôle : Readback physique conforme avant et après chaque variante.
Exécution : runner physique WebGPU.

| Stratégie | CPU (ms) | GPU (ms) | Éléments traités |
|---|---:|---:|---:|
| serial | 0.033 | 15.750 | 100000 |
| atomic | 0.000 | 0.000 | 100000 |
| workgroup | 0.000 | 0.022 | 100000 |

La durée de présentation de l’interface est exclue.
