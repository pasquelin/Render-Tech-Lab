# Rapports Markdown exhaustifs et source de verite

## Objectif

Chaque `REPORT.md` du Render Tech Lab est l'artefact autonome, complet et canonique d'une campagne. Il doit permettre a une IA de comprendre, reproduire, auditer et comparer la campagne sans lire `latest.json`, une archive de campagne, une capture, ni le code du banc.

La taille du Markdown n'est pas une contrainte de produit. Aucune mesure, erreur, entree, sortie, capture ou donnee binaire requise a l'interpretation de la campagne ne peut etre omise pour reduire son poids.

## Perimetre

Le contrat couvre tous les producteurs de rapports des bancs 00 a 15, les rapports de comparaison 04 et 14, les campagnes integrees, la fixture procedurale et Emerald Square. Les rapports existants sont migres si les donnees sont recuperables. Une donnee historique introuvable reste explicitement `null` avec l'origine `legacy-unavailable`; elle ne sera jamais reconstituee ou estimee.

## Contrat `report-complete/v1`

Chaque Markdown contient, dans cet ordre :

1. Un en-tete humain : identite du banc, titre, statut, date, conclusion et limites.
2. La configuration complete : toutes les entrees effectives, protocoles, seeds, ordre des variantes, warmup, resolution, environnement, materiel et capacites.
3. Les observations : toutes les series brutes, echantillons, variantes, compteurs, mesures derivees, erreurs, interruptions et replis. Chaque valeur declare sa provenance et `null` signifie non mesure.
4. Les medias et binaires : chaque image, buffer ou donnees necessaires a son interpretation est integre sans perte sous forme de bloc code base64 avec MIME type, taille et SHA-256. Les images sont egalement rendues dans le Markdown lorsque le lecteur le permet.
5. Les sources et reproductibilite : revisions, hashes et snapshots de fichiers effectivement utilises lorsqu'un banc les archive.
6. Un unique bloc final `json report-complete/v1` qui encode sans transformation ni filtrage l'enveloppe complete de campagne. Les sections precedentes ne sont que des vues de ce bloc.

Le JSON final est la representation machine normative. Les tables et textes humains doivent etre derives de ce meme objet, jamais maintenus separement.

## Ecriture et retention

L'ecriture passe par un writer commun en flux. Il construit le Markdown par morceaux dans un fichier temporaire, calcule les hashes pendant l'ecriture, puis publie atomiquement le fichier final. Les routes HTTP ne parsment plus le corps entier en memoire et n'imposent aucune limite de taille applicative.

Chaque banc conserve exactement deux snapshots complets de campagne dans `results/campaigns/` : le dernier et le precedent, avec leur `report.md` exhaustif. `results/REPORT.md` et `reports/<banc>.md` sont des copies du plus recent. Les anciens archives au-dela de deux sont supprimes seulement apres publication reussie du nouveau rapport. L'historique navigateur Emerald passe egalement de cinq a deux campagnes, avec les memes donnees complètes.

## Lecture dans le Lab

Le Markdown est l'unique source des modals. Une modal ne lit ni `latest.json`, ni une archive brute, ni un etat React pour afficher un rapport. Pour un rapport volumineux, l'API sert le fichier en flux et le lecteur affiche un apercu progressif des sections; les octets du fichier et son contenu restent inchanges.

Les actions Voir rapport, Recharger, Copier et Reveler dans Finder ont le meme contrat sur les seize bancs. Emerald et la fixture procedurale n'ont aucun chemin parallele vers une vue JSON ou un rapport integre.

## Validation

Les tests communs verifieront pour chaque producteur :

- la deserialisation du bloc `report-complete/v1` est egale a la campagne archivee, y compris `null`, erreurs et medias ;
- aucune cle du resultat original n'est absente du bloc final ;
- les medias encodes retrouvent exactement leurs octets et leur SHA-256 ;
- le lecteur de modal demande uniquement le Markdown ;
- la retention conserve exactement les deux dernieres campagnes completes ;
- une campagne arretee ou en erreur reste complete et consultable.

Les tests de taille emploient un rapport volumineux de synthese mais ne fixent aucune limite maximale. Ils verifient la publication atomique et la lecture en flux, pas une performance ou une taille de fichier fictive.

## Limites explicites

Le contrat ne transforme pas une mesure manquante en mesure. Les donnees physiques, GPU, VRAM ou comparaison non executees restent `null` avec leur raison. La migration des rapports historiques ne peut contenir que les octets encore disponibles dans le depot au moment de la migration.
