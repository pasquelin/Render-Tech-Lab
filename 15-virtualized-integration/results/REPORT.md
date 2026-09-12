# 15 — Géométrie virtualisée : rapport

Les trois contrôles procéduraux ont été exécutés. Ce résultat valide leur fonctionnement sur la machine testée, sans conclure à un gain général.

A dessine tous les triangles source. B choisit une représentation complète par région, puis lit les pages disponibles dans un pool GPU borné.

Les images sont comparées exactement aux mêmes poses. La profondeur peut différer avec les niveaux de détail : sa différence et la borne géométrique projetée restent dans les données brutes.

| Contrôle | État | Poses vérifiées | Évictions de pages |
|---|---|---:|---:|
| Qualité exacte, tout résident | terminé | 4 | 0 |
| Niveaux de détail, tout résident | terminé | 4 | 0 |
| Cache sous pression | terminé | 4 | 48 |

Le cas sous pression conserve la surface avec les pages grossières. Il peut dépasser temporairement le budget de détail : ce dépassement est déclaré, pas considéré comme une qualité exacte.

| Bloc | Encodage et soumission CPU (ms) | GPU (ms) |
|---|---:|---:|
| exact-resident:A:0 | 0.075 | 0.426 |
| exact-resident:B:1 | 0.125 | 1.327 |
| exact-resident:B:2 | 0.050 | 1.966 |
| exact-resident:A:3 | 0.050 | 0.508 |
| lod-resident:A:0 | 0.075 | 0.229 |
| lod-resident:B:1 | 0.025 | 1.671 |
| lod-resident:B:2 | 0.025 | 1.180 |
| lod-resident:A:3 | 0.025 | 0.442 |
| streaming-pressure:A:0 | 0.075 | 0.213 |
| streaming-pressure:B:1 | 0.050 | 0.918 |
| streaming-pressure:B:2 | 0.100 | 2.884 |
| streaming-pressure:A:3 | 0.075 | 0.311 |

Ces petits échantillons incluent une instrumentation de contrôle. Les temps GPU absents restent non mesurés. Le temps de frame complet inclut les attentes et les transferts ; il est distinct du temps CPU du tableau.

La RAM et la VRAM physiques ne sont pas instrumentées. Les octets du pool sont une comptabilité des allocations. Les pages proviennent ici de la mémoire CPU ; les copies vers le GPU et les évictions sont réelles.

Limites : petits reliefs statiques, opaques et sans éclairage. Aucune validation d’Emerald Square, de transparence, de déformation ou de scène urbaine complète.

[Télécharger les données brutes et leur provenance](/api/integration-archive?id=fc1a59ad-a60c-442f-9bb6-895c91227805)
