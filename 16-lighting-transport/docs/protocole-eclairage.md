# Protocole des mesures d'éclairage à venir

Ce document fixe, pour les campagnes futures du banc 16, la méthode de preuve à appliquer quand des
composantes qui n'existent pas encore dans le SDK seront disponibles derrière ses API publiques :
ombres par shadow maps, sondes d'irradiance, cache de surfaces, vue réfléchie, oracle path tracer.
Il ne décrit aucune de ces mesures comme déjà réalisée. Les valeurs de tolérance sont des choix
produit non fixés ici : chaque section les note comme des paramètres à renseigner avant la première
campagne, pas comme des constantes.

## Scénarios

Chaque scénario fixe une caméra et une séquence d'événements reproductibles ; il est rejoué à
l'identique pour chaque composante mesurée et pour l'oracle.

- **Démarrage à froid** : première image après chargement de la scène, sans cache ni historique temporel. Vérifie l'absence de dépendance à un état antérieur.
- **Porte qui claque** : fermeture instantanée, cadence rapide. Vérifie la réaction de l'ombre, de l'indirect et d'un éventuel reflet visible depuis la caméra.
- **Porte qui s'ouvre** : symétrique du précédent, expose une pièce jusque-là masquée.
- **Lampe mobile à vitesse fixe** : déplacement continu à vitesse connue et constante ; sépare l'erreur de retard (décalage temporel) de l'erreur d'amplitude.
- **Interrupteur** : extinction puis rallumage instantanés d'une source, sans déplacement.
- **Fente étroite avec petite source intense** : cas contraignant pour l'échantillonnage direct et les ombres portées à bord net.
- **Miroir voyant un objet hors champ** : la caméra ne voit l'objet que par réflexion ; isole l'erreur du chemin réfléchi de celle du direct.
- **Déplacement d'instance** : une instance de géométrie change de position ou de transformation ; vérifie que le cache de surfaces et les sondes suivent l'identité de l'instance et non sa seule position.

Chaque scénario tourne au moins une fois par composante mesurée (direct, indirect diffus, reflet) et
une fois avec toutes les composantes actives ensemble, caméra et budgets identiques entre les
exécutions.

## Métriques par composante

Mesurées séparément pour le direct, l'indirect diffus et le reflet, en radiance linéaire, avant tout
tone mapping, face à l'oracle défini pour ce scénario.

- **Erreur normalisée** : par tolérance absolue *et* par tolérance relative (deux paramètres à renseigner par composante et par scénario ; aucune valeur unique ne convient aux trois composantes). Un pixel est hors seuil si les deux marges sont dépassées.
- **Maximum, p95, p99** de l'erreur normalisée sur l'image.
- **Fraction de pixels hors seuil**.
- **Erreur dans des régions ciblées** : la pièce derrière la porte, un mur coloré de référence, le contenu visible dans le miroir. Chaque région est un masque de pixels fixe par scénario, pas une estimation visuelle.
- **Pic d'erreur et délai de retour sous le seuil après l'événement** : instant du pic, puis premier instant où l'erreur normalisée reste sous le seuil de façon durable (paramètre à renseigner : nombre d'images consécutives exigé).
- **Erreur des variations temporelles** : différence image à image de la composante mesurée comparée à la même différence côté oracle, pour capturer un scintillement que l'erreur par image isolée ne verrait pas.
- **Incertitude de l'oracle** : l'oracle path tracer a lui-même une erreur d'échantillage. Cette incertitude doit être mesurée et rester sous le seuil de comparaison ; si elle ne l'est pas, le verdict de la composante est **indéterminé**, jamais arrondi à un succès ou un échec.

## Mesures de coût

Jamais additionnées entre elles ; chacune reste identifiable à son étape ou sa passe d'origine.

- **CPU par étape** (préparation de scène, mise à jour de cache, mise à jour de sonde, soumission).
- **GPU par passe**, ou `null` si non mesuré ; jamais estimé par différence avec le CPU.
- **p95 et p99 du temps d'image**, et compte des dépassements de 8,33 ms (référence 120 Hz) sur la séquence.
- **Mémoire** : allocations propres à chaque composante (cache de surfaces, sondes, buffers de reflet), bornées et distinguées d'une estimation d'admission.
- **Latence de la GI** : délai entre l'événement déclencheur et une réponse de l'éclairage indirect jugée stable, mesurée sur les données comme le τ95 du banc « Retard de réponse lumineuse », pas estimée.

Consignés à chaque campagne : résolution, DPR, fréquence d'affichage effective (mesurée en mode
visible, jamais supposée), matériel, commit SDK et commit Lab, charge machine au moment de la mesure
(processus concurrents, throttling thermique si observable).

## Verdict

Par composante et par scénario : réussi, échoué ou indéterminé (incertitude de l'oracle insuffisante,
ou capacité absente du SDK à cette date). Un échec de composante ne masque pas les autres : le
rapport garde le détail par composante plutôt qu'un seul verdict global.

## Format du rapport et de l'archive

Aligné sur les campagnes existantes du banc : un dossier `reports/16-lighting-transport/campaign-<id>/`
avec `REPORT.md`, les objets machine compressés (`objects/result.json.gz`), les journaux
(`logs/engine-events.jsonl`) et les médias (`media/` ou un sous-dossier dédié pour des artefacts non
image comme une vidéo). Le rapport Markdown reprend les sections de ce protocole : scénarios exécutés,
tableau des métriques par composante et par région ciblée, coûts jamais additionnés, provenance
(commits, empreintes des sources servies, résolution, DPR, matériel, charge machine), verdicts avec
leur statut indéterminé explicite. Toute valeur non mesurée reste `null` dans les données et « Non
mesuré » dans le texte ; aucune estimation n'est présentée comme une mesure.
