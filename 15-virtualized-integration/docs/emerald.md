# Candidat réel : NVIDIA Emerald Square (ORCA)

Recommandation : conserver le contrôle procédural sans asset externe pour la recette courte, puis utiliser **Emerald Square Day** comme fixture urbaine réelle séparée. Une ville réassemblée procéduralement à partir d'assets ORCA ajoute du travail de composition et de validation sans supprimer leurs contraintes de licence. Emerald fournit une référence commune; un générateur reste préférable pour provoquer précisément une téléportation, un dépassement de budget ou une panne de page. Aucun des deux ne valide à lui seul la matrice entière.

## Ce qui a été effectivement vérifié

Le 12 septembre 2026 : page NVIDIA, HEAD HTTP, répertoire central ZIP et petits README/licence/pyscene lus par requêtes Range bornées. **116 761 octets lus**, sans téléchargement des meshes/textures. L'inventaire complet et les notices sont archivés dans `emerald-directory.json`. Le SHA-256 de l'archive entière est inconnu avant téléchargement.

| Élément | Observation |
|---|---|
| ZIP `EmeraldSquare_v4_1.zip` | 617 345 248 octets, environ 589 Mio; serveur accepte Range |
| Somme des tailles décompressées déclarées | 1 544 054 516 octets, environ 1,44 Gio; ce n'est pas de la RAM/VRAM mesurée |
| Entrées ZIP | 362, dont 2 répertoires |
| Géométrie | `EmeraldSquare_Day.fbx` 147 767 216 octets; `EmeraldSquare_Dusk.fbx` 147 803 856 octets |
| Textures/environnement | 351 DDS, 2 HDR; en-têtes locaux vérifiés ci-dessous |
| Compléments | 2 pyscene, README, LICENSE, CHANGELOG |

La source et son README annoncent 10 046 405 triangles instanciés par scène, pour 2 695 054 uniques. PBR metal/rough : BaseColor RGB, opacité alpha; Specular packe occlusion/roughness/metalness en RGB; normales DirectX; émissif RGB. Le changelog signale caméra et lumières dans les FBX, feuillages double face, et ajustement émissif ×5 au crépuscule. Ces propriétés sont des déclarations du paquet, pas une inspection du graphe FBX. La description de quatre blocs tuilables/jardin reçue avec la demande reste à confirmer dans la géométrie avant de publier une recette de placement. [Source NVIDIA et téléchargement officiel](https://developer.nvidia.com/orca/nvidia-emerald-square).

## Chemin local et conversion reproductible à préparer

Déposer le ZIP dans `/Users/pasquelin/Applications/render-tech-lab/files_local/orca/EmeraldSquare_v4_1.zip`. `files_local` est déjà ignoré par Git; créer les dossiers si absents. Ne pas servir le ZIP dans `public/`. Le dossier public Emerald futur aura besoin de sa propre règle d'exclusion; seule la règle Bistro existe actuellement.

Avant conversion, enregistrer SHA-256, taille, licence et version; extraire avec contrôle des chemins, tailles totales et collisions. Le répertoire distant n'a pas validé CRC/contenu des gros membres. Ne pas exécuter les `.pyscene` téléchargés : interpréter manuellement leurs quelques paramètres connus.

Blender est présent localement. La recette Bistro dans `14-open-world/assets/tools/convert_bistro.py` contient déjà la conversion ORM et l'inversion du canal vert des normales. Elle **refuse les sources autres qu'Exterior** et sa normalisation opaque ne convient pas aux feuillages. Il faut extraire les fonctions communes, puis une recette Emerald versionnée; ne pas appliquer aveuglément le script Bistro.

Protocole proposé, non exécuté : fixer version Blender/importeur/exporteur, importer Day en conservant instances et identités, vérifier unités/axes/transforms et textures manquantes; convertir DDS vers formats compatibles glTF, préserver espace sRGB/linéaire, alpha et double face, séparer chemins opaques/alpha; exporter un glTF/GLB sans décimation initiale. Conserver lumière/environnement/caméra dans un manifeste de banc. Exporter deux fois et comparer géométrie, matériaux, images et hashes normalisés. Un glTF valide ne prouve pas que le shading correspond au FBX : contrôler vues de référence, normales et transparence.

A/B doit lire exactement ce même résultat converti. Les versions réduites pour petites machines sont de nouvelles fixtures nommées, identiques entre A/B, jamais une réduction réservée à B. La transformation en format paginé du moteur reste bloquée par les records/compilateur de hiérarchie manquants; ne pas baptiser un GLB monolithique « streaming virtualisé ».

Réserver l'espace pour ZIP, extraction, textures converties, export et staging; ne pas déduire le pic RAM/VRAM de la taille ZIP. La décompression DDS vers pixels puis PNG peut augmenter fortement le coût. Temps de lecture/décodage/conversion, pic mémoire, taille glTF et coût CDN demeurent inconnus jusqu'au vrai traitement.

## Licence et redistribution

Le paquet porte CC BY-NC-SA 3.0 : attribution, usage non commercial et partage des adaptations sous les conditions prévues. Conserver NVIDIA, auteurs, lien et notices; documenter conversion/modifications. Le code MIT du labo ne permet pas de relicencier les assets sous MIT. La licence distingue adaptations et collections : elle ne place pas automatiquement tout le moteur sous CC, mais le caractère non commercial d'une utilisation produit doit être clarifié avant diffusion. Réassembler procéduralement les assets ne supprime pas ces obligations. Garder les téléchargements locaux et publier d'abord recette/manifeste; une distribution convertie nécessite de vérifier aussi les notices de végétation et HDR. [Texte officiel CC, sections 1, 3 et 4](https://creativecommons.org/licenses/by-nc-sa/3.0/legalcode.en).

Avant intégration : téléchargement terminé et hash, validation des notices/usages, recette commune adaptée à l'alpha, contrôle de conversion sans pertes, puis chargement réel dans un renderer compatible. Aucun gros paquet n'a été téléchargé par cette tâche. L'Open World Demo Collection Epic n'est pas candidate, conformément à la demande.

## Mise à jour après réception locale

Le dossier utilisateur a été inspecté puis déplacé de `public/EmeraldSquare_v4_1` vers `/Users/pasquelin/Applications/render-tech-lab/files_local/emerald-square/EmeraldSquare_v4_1` par renommage sur le même disque. Les 360 fichiers ont les tailles du répertoire ZIP; mêmes inodes avant/après, ancien dossier public absent, destination confirmée ignorée par Git. Ce déplacement demandé est la seule écriture de cette tâche dans le checkout principal.

`emerald-local-inspection.json` conserve les en-têtes lus : deux FBX binaires version 7300; DDS : 175 DXT1, 115 ATI2, 61 DXT5; dimensions : 302 en 2048×2048, 43 en 16×16, 6 en 1×1. Le décodeur doit donc prendre en charge ATI2, pas seulement DXT1/DXT5, et restituer correctement les normales. La correspondance de tailles établit une intégrité apparente, pas un contrôle CRC de chaque fichier ni une importation réussie. Aucun mesh ou texture n'a été décodé et aucune conversion massive n'a été lancée.

## Exploration dans le Lab principal

Ouvrir `http://localhost:5174/?test=15-virtualized-integration`. Le sélecteur de scène propose Emerald Square (ville complète) ou la fixture procédurale. Emerald Square est un asset du Lab ; le rendu passe par `createExplorer` de `@web-geometry/sdk/browser`, avec un manifeste et un scope `full` fournis par le Lab. L’étendue 1 / 4 / 9 est `replicaCount`. La caméra orbitale et la caméra libre sont indépendantes de la campagne ; les mesures comparatives complètes restent désactivées tant que le contrôle A/A est instable.

Depuis Web Geometry, construire le SDK et le compilateur natif (`npm run build:native` à la racine du SDK). Depuis le Lab, lancer `npm run prepare:emerald` pour publier le cache dans `public/benchmark-assets/emerald-derived/native/full` **avec** `simplification: 'qem-endpoints'`. Sans cette recompilation, le Lab refuse le cache (`simplification !== true`). Le compilateur ajoute lui-même `native/<scope>` : ne pas fournir `full` une seconde fois. Les sources Emerald converties doivent déjà exister dans `public/benchmark-assets/emerald-square`.

L’explorateur envoie `pixelError` (défaut 1 px) à `createExplorer` : la coupe LOD QEM est active. 0 px force les feuilles exactes.

Le serveur Vite sert le cache à la demande, y compris les fichiers préparés après son démarrage. Le loader vérifie statut HTTP, type JSON et schéma avant lecture. Le panneau de chargement affiche la ressource traitée ; une erreur technique est visible dans le Lab avec possibilité de réessayer. Changer de banc, de scène ou arrêter l’exploration annule le travail et libère contrôles, boucle et renderer ; les résultats tardifs du chargeur glTF sont rejetés et libérés à leur arrivée.

La télémétrie distingue CPU rendu, intervalle rAF, dessins/triangles soumis et pages lues. GPU et VRAM restent non mesurés. Les pages sont préparées et chargées avant exploration ; ce chemin de référence WebGL2 n’est pas un streaming géométrique WebGPU.

La vue triangles soumet les triangles réellement sélectionnés par le moteur affiché, une couleur unique par triangle.

Le parcours urbain (`pathVersion` 2, dix segments) est un test automatique : un lancement enchaîne Three.js, WebGeometry et `THREE.LOD` sur les mêmes poses, en rendu texturé. Une photo réelle et ses infos techniques (pose, FOV, moteur, backend, triangles, pages, CPU, résolution) sont prises au début de chaque segment. Le sélecteur de moteur reste un bonus d’exploration libre. Pas de verdict de performance tant que le contrôle A/A de la ville complète est instable.

Recette Chrome : `node test/emeraldExploration.browser.mjs`. Elle vérifie erreur HTML/Réessayer, chargement sans cache réseau, orbit/free, arrêt/reprise, changement de scène/banc, retour, rechargement direct et resize. Les captures et réponses réseau sont archivées sous `benchmark-runs/checks/emerald-ui`, sans verdict de performance.
