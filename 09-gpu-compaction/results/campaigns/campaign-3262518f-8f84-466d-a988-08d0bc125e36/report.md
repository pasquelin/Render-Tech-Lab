# 09-gpu-compaction — campagne intégrée

Date : 2026-09-12T14:09:27.546Z.
Statut : measured.
Contrôle : Readback physique conforme avant et après chaque variante.
Exécution : runner physique WebGPU.

| Stratégie | CPU (ms) | GPU (ms) | Éléments traités |
|---|---:|---:|---:|
| serial | 0.033 | 15.095 | 100000 |
| atomic | 0.067 | 0.044 | 100000 |
| workgroup | 0.067 | 0.022 | 100000 |

La durée de présentation de l’interface est exclue.
