# Banc 15 — recette du 12 septembre 2026

Source testée : projet principal `render-tech-lab`, servi sur `http://localhost:5174` par Vite. Aucun commit ni push.

## Résultat physique

Les trois recettes Chrome suivantes ont terminé sans erreur JavaScript :

- `test/emeraldAvailability.browser.mjs` : cache absent, réessai, cache disponible, changement de scène, aucun canvas Emerald ni géométrie/texture avant clic, lancement et arrêt.
- `test/emeraldPixels.browser.mjs` : rechargement dur, aller-retour via le banc 01, fiche commune alignée en haut, première image non uniforme, rotation de caméra et redimensionnement. Le framebuffer et le canvas CSS étaient tous deux de 913 × 806 pixels ; la capture comptait 7 557 couleurs et 54 562 échantillons différents du premier pixel.
- `test/emeraldWorkbench.browser.mjs` : 1, 4 et 9 villes en détails maximum ; caméra libre ; vues texturée, filaire, clusters et pages ; variation des clusters et évictions réelles au zoom ; panneau B explicitement indisponible ; parcours complet ; cinq rapports conservés ; Emerald → Nouvelle exécution → fixture terminée → Nouvelle exécution → Emerald, sans rechargement et sans canvas au repos dans la fixture.

Le parcours a produit 480 échantillons et huit captures après 30 images de préchauffage exclues. Les recettes longues ignorent les messages HMR de mise à jour/rechargement pour qu’une édition concurrente ne supprime pas une campagne. Elles chargent le code réel du serveur par navigation explicite.

Preuves locales : [résultat des configurations](../../benchmark-runs/checks/emerald-workbench/result.json), [parcours et échantillons](../../benchmark-runs/checks/emerald-workbench/path.json), [pixels](../../benchmark-runs/checks/emerald-pixels/result.json), [fiche initiale](../../benchmark-runs/checks/emerald-pixels/idle.png), [ville](../../benchmark-runs/checks/emerald-pixels/city.png), [rapport](../../benchmark-runs/checks/emerald-workbench/report.png).

## Validation automatisée finale

- Lab : compilation TypeScript/Vite réussie ; 27 tests ciblés réussis (disponibilité, parcours, contrat des statistiques et tests du banc 15).
- SDK : compilation réussie ; 35 tests réussis.
- La validation générale du Lab avait réussi avant les dernières migrations communes. Elle n’est pas revendiquée comme validée sur l’état final de 00–14 : ces comportements et leurs tests sont réservés à leur reprise exclusive.

## Limites explicites

- Les quatre diagnostics ont été testés physiquement sur une ville. Les étendues 4/9 ont été testées en rendu texturé, détails maximum.
- Les copies de ville partagent géométries, matériaux et textures. Détails maximum conserve les données source et utilise l’anisotropie maximale disponible.
- Clusters/pages : sélection CPU exacte, avec transparences partagées conservées. Les pages attachées/évincées décrivent la scène de clusters ; elles ne mesurent pas la VRAM physique. La référence ne présente pas son nombre de maillages comme un nombre de pages résidentes.
- Le dépassement du budget de pages est couvert par un test SDK : il refuse une surface incomplète. Ce n’est pas une recette Chrome d’épuisement mémoire.
- Le parcours est géométrique et déterministe ; les rues et zones de végétation ne sont pas calibrées. Les captures de repérage ne sont pas un oracle de fidélité A/B et peuvent affecter l’intervalle rAF suivant.
- CPU frame mesure l’appel de rendu complet. CPU submit isolé, temps GPU et VRAM sont non mesurés.
- B optimisé complet et comparaison mesurée restent indisponibles ; le contrôle A/A instable n’est pas contourné. Aucun gain de performance n’est annoncé.

## Fichiers partagés touchés pendant le chantier

Ces fichiers ont également reçu du travail concurrent. Cette liste décrit les surfaces à relire pour la reprise 00–14, sans attribuer toutes leurs modifications à ce chantier.

- [UnifiedLab.tsx](../../src/components/UnifiedLab.tsx) : routage vers les contrôleurs Emerald/fixture ; franchissement explicite de la frontière du banc 15.
- [LabContext.tsx](../../src/components/LabContext.tsx) : modèle Emerald et choix de scène.
- [LabViewport.tsx](../../src/components/LabViewport.tsx) : branche Emerald et exclusion des canvases principaux inutilisés de la fixture.
- [LabSidebar.tsx](../../src/components/LabSidebar.tsx) : champs propres au 15, sélection unique, en-tête cohérent, graphique de fixture seulement pendant exécution.
- [LabNavbar.tsx](../../src/components/LabNavbar.tsx) : description Emerald et verrouillage de navigation travaillés antérieurement.
- [PreparationStation.tsx](../../src/components/PreparationStation.tsx) : données de présentation injectées et contenu/commandes du rapport Emerald dans la fiche commune.
- [ActionBar.tsx](../../src/components/ui/ActionBar.tsx) : intention optionnelle « Nouvelle exécution ».
- [labState.ts](../../src/lab/labState.ts) : action optionnelle `newExecution`.
- [bootLab.ts](../../src/lab/bootLab.ts) : retour au repos ; adaptations temporaires de surfaces/graphique et vérifications sans DOM ont aussi été touchées pendant la migration concurrente. Relire l’état final avant une nouvelle modification globale.
- [modulePresentation.ts](../../src/lab/modulePresentation.ts) : présentation du banc 15 travaillée antérieurement.
- [package.json](../../package.json), [pnpm-lock.yaml](../../pnpm-lock.yaml), [vite.config.ts](../../vite.config.ts), [.gitignore](../../.gitignore) : consommation locale du SDK et service des assets préparés.
- [labStatsContract.test.ts](../../test/labStatsContract.test.ts), [preparationStation.test.ts](../../test/preparationStation.test.ts), [renderOwnership.test.ts](../../test/renderOwnership.test.ts) : fixtures/attentes adaptées durant le chantier avant la consigne finale de séparation 00–14.

`test/labRouteIsolation.test.ts` et `test/routes00to14.browser.mjs` ont été conservés sans modification par ce chantier.

Les contrôleurs `EmeraldLab.tsx` et `IntegrationFixtureLab.tsx`, les corps de panneaux Emerald et les modules `emeraldAvailability`, `emeraldCampaign`, `emeraldView` sont propres au banc 15. La fixture crée sa session après le clic puis utilise le même LabShell et les mêmes composants visuels.

Le SDK possède les changements de grille partagée, diagnostics, compteurs, cadrage, libération du contexte et budget de pages ; le Lab ne duplique pas ces algorithmes.
