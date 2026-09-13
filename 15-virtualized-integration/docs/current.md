# Incrément 2 — assemblage physique, 12 septembre 2026

Le runner 15 exécute désormais par défaut **une véritable hiérarchie procédurale à deux niveaux avec sélection GPU et pages physiques**. Ce n'est plus seulement le contrôle résident du premier jalon. Le domaine prouvé reste volontairement petit : 64 régions statiques opaques, matériau constant par région, caméra perspective frontale. Aucun résultat de performance sur Emerald Square ni sur une hiérarchie générale de meshes arbitraires.

L’explorateur Emerald Square charge la ville préparée via `@web-geometry/sdk/browser`. L’exploration libre propose Three.js, pages WebGL2, `THREE.LOD` et le raster WebGPU. Le parcours urbain v4 enchaîne Three.js, pages WebGL2 et raster WebGPU sur les mêmes poses (hors `THREE.LOD`). Une campagne par moteur, puis `comparePathReports`. Le contrôle A/A de la ville complète reste instable : aucune campagne n’est marquée mesurée. GPU et VRAM restent non mesurés. La vue « Triangles soumis » colore chaque triangle rasterisé ; ce n’est pas un filaire GL_LINES.

## Ce qui fonctionne ensemble

`implementation/geometryAsset.ts` réutilise le constructeur de meshlets du banc 05. Chaque région est un relief triangulé à sommet central et quatre faces fines, remplaçables collectivement par deux faces planes. Les frontières sont identiques; les coordonnées et hauteurs sont dyadiques. Une correspondance verticale sur le même domaine XY borne dans les deux directions l'écart par la hauteur. C'est une preuve analytique propre à cette famille; pas un certificat issu d'un simplificateur général. Les tests échantillonnés vérifient la transcription, sans transformer l'échantillonnage en preuve formelle flottante.

`regionErrorPx` utilise l'oracle `shared/math/geometry.ts/projectedErrorBound`. Le shader reprend la même borne (facteur conservateur supplémentaire 1.00001). Une égalité reste grossière; un franchissement du near plane exige le fin. Le CPU et le GPU sont comparés sur les poses effectivement utilisées. Le contrat ne prétend pas certifier toutes les égalités flottantes adversariales du shader.

`implementation/clusterGpu.ts` exécute frustum conservateur, choix grossier/fin/racine de secours, compactage atomique borné et feedback de pages en WGSL. Un seul cluster par région peut être émis; le tableau de sortie a une case par région. Le raster lit les vrais sommets du pool par vertex pulling et une commande indirecte. Les clusters grossiers sont complétés par deux triangles dégénérés valides; les invocations supplémentaires sont comptées séparément des triangles utiles. A lit les faces fines source, sans simplification, avec le même shader/matériau/caméra/résolution.

`implementation/physicalPages.ts` possède un véritable buffer GPU à slots fixes de 192 octets. Les racines restent épinglées. Les pages fines passent par `PageSource.read`, contrôle d'intégrité, `queue.writeBuffer`, puis publication après complétion. L'éviction attend la fin de tous les lecteurs de cette référence conservatrice; aucun slot utilisé par une frame en vol n'est réattribué. LRU global, requêtes concurrentes refusées, annulation des lectures tardives et fermeture du pool sont testés. L'implémentation mémoire de PageSource copie effectivement les octets : ce n'est pas un accès disque ou réseau. Une source asynchrone différente peut être injectée; son comportement disque/réseau n'a pas été mesuré.

## Trois scénarios exécutables

| Cas | Politique | Ce que le contrôle établit |
|---|---|---|
| exact-resident | seuil 0, 128 slots pour 64 racines + 64 fines | mêmes faces utiles que A; sélection/compactage/raster physiques |
| lod-resident | seuil 2 px, 128 slots | passage effectif au grossier sur les vues lointaines, borne déclarée et frontières conservées |
| streaming-pressure | seuil 0, 72 slots, demandes par lots bornés de 8 | demandes GPU, hits/misses, copies, uploads, évictions réelles, couverture par racines en cas de manque |

Le scénario streaming **dépasse temporairement le budget d'erreur demandé** quand une page fine manque. La couverture reste complète. Les fallbacks, leur nombre et leur borne d'erreur sont rapportés; une réussite du test de fallback ne signifie pas que ce budget nul est respecté.

Sur la première campagne physique, le cas LOD utilise 64 clusters grossiers à la pose lointaine. Le cas streaming compte 48 évictions. Ce sont des observations du smoke archivé, pas un gain ni une estimation de VRAM. Aucune case ville/intérieur/transparence/objets dynamiques de la matrice générale n'est validée par cette fixture.

## Protocole et provenance

640×360, 4 poses par défaut (maximum 16), ABBA, deadline 90 s interne et deadline du runner englobant. Le protocole est **un smoke instrumenté sans échauffement**, pas une campagne comparative de performance. Chaque scénario contrôle A/A/B en RGBA8 à toutes les poses, compare l'ensemble des clusters à l'oracle CPU, mesure l'écart de profondeur et exige un rendu non vide. Le matériau sans éclairage permet une couleur identique malgré la différence de relief; cette équivalence ne prouve donc ni normales ni shading PBR identiques.

Pendant les frames chronométrées : pas de capture d'image; lecture du feedback et attentes de streaming incluses dans `frameWallMs` et les intervalles rAF. Le coût d'encodage/soumission CPU est séparé. GPU : vrai timestamp de raster A ou enveloppe compute+raster B; null sans queries, deltas nuls signalés, enveloppes absurdes refusées. La préparation de l'asset, celle des ressources, les compteurs de cache et les temps de lecture/fence sont archivés. RAM/VRAM physiques restent nulles. `poolAllocatedBytes` est une taille d'allocation API, pas une mesure matérielle.

Les pipelines de rendu classiques et virtuels sont tous deux présents dans cette référence de vérification; le pool B ne mesure pas toute la mémoire d'un moteur final. Le pool garde les pages sources CPU pour les contrôles d'intégrité. Une page manquante ne doit pas être qualifiée de résidente par le seul compteur logique du banc 11.

## Contrat et interface commune

`createIntegratedRunner('15-virtualized-integration')` ou `createVirtualizedIntegrationRunner()` lancent l'incrément 2. `mode:'resident-control'` conserve le diagnostic du premier jalon. Les réglages de ce diagnostic sont dans `archive.configuration`; les réglages réellement utilisés par la campagne virtualisée sont exclusivement dans `archive.virtualized.configuration`.

Succès local : `archive.architectureStatus='procedural-validated'`; la matrice générale reste séparément `not-run`. Annulation/erreur : résultat `not-run`, scénarios incomplets marqués `not-run`, données partielles conservées. Le code renvoie les archives; la coque les sauvegarde même après un arrêt.

L'intégration est dans les composants existants : descripteur, sélecteur de banc, visibilité du canvas, moteur d'exécution commun. Aucun composant de mise en page spécifique. La préparation reste descriptive et sans rendu; exécution bornée, synthèse commune, rapport et relance. L'API locale `/api/integration-archive` conserve un JSON unique dans `benchmark-runs/checks/15-ui-<uuid>/raw.json`, les sources au moment de l'archivage et le rapport commun. Son snapshot ne certifie pas l'absence de modification pendant le run; le harness CLI conserve en plus les hashes avant/après. Les données brutes sont téléchargeables depuis le rapport.

## Vérification et suite

Tests CPU : couverture et déterminisme des pages, borne projetée hors axe, égalité et near plane, publication après fence, racines non évictables, comptage exact des copies, mauvais payload, annulation d'une lecture qui ne termine pas, archives partielles. Le smoke GPU vérifie les trois cas avec/sans timestamps et l'annulation aux phases verify/measure.

`node bench/run_integration.mjs --ui` vérifie également dans Chrome le cycle IDLE→COMPLETED, une deuxième exécution et le rapport archivé dans la coque React commune. Construire d'abord (`tsc --noEmit`, `vite build --configLoader runner` dans ce worktree lié aux dépendances partagées).

Prochaine extension : modèle de groupe plus profond et simplification avec certificat de surface indépendant, puis source disque/HTTP et anneau de feedback non bloquant. Emerald est prêt comme source locale inspectée, mais sa conversion ATI2/alpha/double-face et sa licence restent des conditions d'intégration; voir EMERALD.md. Aucune conversion lourde n'a été lancée.
