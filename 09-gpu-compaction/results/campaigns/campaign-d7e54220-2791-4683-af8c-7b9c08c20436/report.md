# 09-gpu-compaction — campagne intégrée

Date : 2026-09-12T14:10:12.898Z.
Statut : measured.
Contrôle : Readback physique conforme avant et après chaque variante.
Exécution : runner physique WebGPU.

| Stratégie | CPU (ms) | GPU (ms) | Éléments traités |
|---|---:|---:|---:|
| serial | 0.033 | 14.855 | 100000 |
| atomic | 0.000 | 0.000 | 100000 |
| workgroup | 0.000 | 0.044 | 100000 |

La durée de présentation de l’interface est exclue.
