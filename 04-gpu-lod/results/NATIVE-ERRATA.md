# Rectifications des premiers essais natifs

Les archives initiales sont conservées sans altérer leurs données brutes.

- `20260911T232820908Z-5badffdc-ef8e-4f27-bd48-15bc9f1c6651` : rejet de compilation. Le champ `meta` du shader 04C était un mot réservé WGSL. Aucun rendu ni temps de performance accepté.
- `20260911T232903529Z-8f03d85a-bf1c-4a5e-aaec-ce2eca2666b8` et `20260911T232914283Z-0acc2203-891b-4125-82be-ff64f654d4db` : **enveloppes GPU de la référence A invalides**, malgré le statut initial `completed`. Les passes de calcul vides renvoyaient des timestamps nuls et l’enveloppe résultante était aberrante (environ 250 millions de millisecondes). Ne pas employer ces essais comme preuve comparative GPU. Les contrôles des images avaient réussi. Le protocole corrigé ne lance et ne chronomètre que le raster pour A.
- `20260911T232929667Z-e9dcb94f-f74c-4269-97f3-998258275993` : à 50 000 objets en 4K, aucune différence de sélection mais 296 pixels A/B différents. Mesures rejetées avant les blocs chronométrés. L'ordre non déterministe de compaction est une hypothèse, à vérifier avec une compaction stable.

Ces premiers parcours ne modifiaient pas la distribution LOD aux poses contrôlées. Le parcours suivant ajoute un éloignement puis rapprochement de la caméra, de facteur 1 à 4 puis 1, pour éprouver réellement les changements de niveau. Les résultats de parcours différents doivent rester séparés.

- `20260912T003555628Z-86f924c4-9fc3-444d-8925-e80ac8918290` : **Résolution validée**. À 50 000 objets en 4K (3840×2160), 240 échantillons mesurés, 60 échauffement, ordre ABBA avec trajectoire zoom 1x à 4x :
  - Compaction stable par préfixes locaux (`NATIVE_LOD_LOCAL_RANK` et `NATIVE_LOD_COMPACTION`) garantissant un ordre d'instances strictement identique à la référence CPU (`compactedOrderMismatches: 0`).
  - Écart de pixels nul : `abDifferentPixels: 0`, `abMaxChannelError: 0` sur toutes les poses de contrôle (0, 119, 239 initiales et 239 finale). Les empreintes SHA-256 de rasterisation A et B sont strictement identiques.
  - Oracles de sélection et de commandes indirectes vérifiés sans divergence : `selectionMismatches: 0`, `commandMismatches: 0`.
  - Timestamps GPU physiques mesurés avec succès (`TimestampBatch`) : 4 passes GPU distinctes pour B (sélection ~0.04 ms, comptage rangs ~0.02 ms, dispersion compaction ~0.15 ms, raster ~4.4 ms). Statut contractuel : **completed** et qualité **passed: true**.

