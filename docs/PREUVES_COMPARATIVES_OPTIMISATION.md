# Preuves comparatives d'optimisation — 11 septembre 2026

> Archive narrative historique : les annexes de sources et de mesures ont été supprimées volontairement par l’utilisateur le 12 septembre 2026. Elles ne font plus partie de la documentation active. Les procédures de reproduction et les vérifications décrites ci-dessous témoignent de l’état antérieur ; elles ne sont plus reproductibles depuis ce seul checkout et ne constituent pas une validation actuelle.

**Décision : aucun remplacement des calculs de référence n'est adopté.** La préparation de la tangente accélère la fonction CPU du prototype sur la machine testée et conserve les sorties contrôlées. Les mesures de scène ne démontrent pas une amélioration de fluidité. Le cache de projection présente une régression lorsque ses données changent à chaque évaluation. Ces résultats ne satisfont donc pas les conditions cumulatives demandées : plus performant, plus fluide, sans perte fonctionnelle ou visuelle.

Ce document conserve des résultats exécutés, y compris négatifs. Il ne présente aucune variante comme « meilleur calcul » universel. Les équations de [M05](../../webGeometry/docs/mathematiques/CALCULS_ESSENTIELS.md) et les [oracles Python](../../webGeometry/docs/mathematiques/ORACLES_ET_TESTS.md) restent les références.

## 1. Dossier de preuve et domaine


Matériel réellement mesuré : **Apple M2 Max, 12 cœurs logiques, 96 Gio de RAM**, macOS avec noyau Darwin **25.6.0**. CPU : Node **26.8.2**, V8 **14.6.202.34-node.28**, arm64. Navigateur : Chrome **152**, Three.js **r174**, **WebGL2**, ANGLE Metal sur Apple M2 Max, ratio de pixels 1. L'identité du GPU vient du contexte WebGL ; la chaîne de navigateur mentionnant « Intel Mac » ne décrit pas le processeur réel.

Cette machine n'est pas représentative d'un petit portable. GPU intégré d'entrée de gamme, 8–16 Gio de RAM, Windows/Linux, batterie, chauffe prolongée, Electron et WebGPU : **non mesurés**. L'âge inférieur à cinq ans ne suffit pas à déduire leurs performances. Aucun temps GPU, pic mémoire de processus ou coût énergétique n'a été mesuré ; les valeurs indisponibles restent `null`.

Les essais ont utilisé des fichiers temporaires et les sources locales en lecture. Ils ne modifient pas le moteur ni les rapports historiques du laboratoire. La campagne navigateur est une scène de contrôle synthétique, pas une recette complète de l'application.

### Couverture effective des paramètres

| Paramètre | Preuve disponible | Limite de validation |
|---|---|---|
| Résolution dans le calcul CPU 04B | Deux contextes chronométrés utilisent des hauteurs de 1 080 et 2 160 pixels | Caméra et FOV changent aussi entre contextes ; ce n'est ni une étude isolée de résolution, ni un rendu Full HD/4K. |
| Résolution des comparaisons d'image | 640×360 et 960×540 physiques, ratio de pixels 1 | Full HD, 1440p, 4K, Retina et ratio non 16:9 non contrôlés visuellement. |
| Résolution des mesures de cadence | 640×360 physiques uniquement, ratio de pixels 1 | Aucun gain de fluidité démontré, aucune extrapolation aux résolutions supérieures. |
| Caméra et projection | Cinq cadrages de contrôle et une trajectoire déterministe, projection perspective | Ni orthographique, ni vues multiples, ni jitter temporel ou projection décentrée validés. |
| Charge et fonctionnalités | Fonction CPU jusqu'à 100 000 objets ; scène rendue de 2 000 sphères avec trois LOD, matériau et éclairage fixes | Pas de preuve de rendu à 100 000 objets, ni de recette complète d'ombres, transparence, animation, picking, streaming ou effets temporels. |
| Machine et backend | Un M2 Max, Node et Chrome/WebGL2 | Petites machines, autres OS, Electron/WebGPU, batterie et chauffe prolongée non mesurés. |
| Coût total et mémoire | Temps CPU, intervalles rAF, taille explicite du tableau de cache | Temps GPU, présentation physique, pics mémoire et énergie non mesurés. |

Cette couverture est insuffisante pour valider une optimisation globale de scène. Les futures décisions doivent suivre la [matrice des paramètres et interactions](PLAN_EXPERIENCES_PERFORMANCE.md), sans transformer les cases non mesurées en garanties. Les données historiques ci-dessous restent inchangées.

## 2. Tangente préparée : gain de la fonction CPU, portée limitée

La référence mesurée est la véritable fonction `selectLodsOnCpu` de `04-gpu-lod/implementation/cpuLodSelector.ts`, importée par le banc. Elle emploie ce diamètre radial approximatif :

```text
diameter_pixels = (diameter * height) / (2 * distance * tan(fov * 0.5))
```

La seule modification de calcul dans la candidate est d'évaluer `tan(fov * 0.5)` une fois par appel, au lieu de le refaire pour chaque objet. Les gardes, l'ordre des multiplications et de la division, les seuils LOD, allocations, compteurs et forme du résultat sont conservés. Il n'y a pas de cache entre appels : un changement de FOV est immédiatement pris en compte. La durée retournée est naturellement différente et ne fait pas partie des valeurs exigées identiques.

Pour des nombres primitifs et des tableaux ordinaires, chaque objet utilise le même argument de tangente dans les deux variantes. Préparer sa valeur n'introduit ni approximation trigonométrique ni réassociation arithmétique. Cela ne justifie pas de remplacer la division par une multiplication par l'inverse : cette autre transformation n'est pas testée ici. Les objets avec conversions à effets de bord ou `Proxy` sont hors domaine.

**Attention au sens de la formule :** la référence 04B mesure la taille radiale d'un objet, pas la borne d'erreur géométrique hors axe de M05. Son accélération ne corrige ni ne valide le modèle géométrique du futur moteur.

### Vérification des sorties

Chaque exécution du banc contrôle **1 492 cas : 763 comparaisons de fonction complète et 729 comparaisons scalaires**. Les contrôles portent sur les octets LOD, distributions, absence de mutation des entrées et résultats précédents, tailles de tableaux, valeurs non finies, zéro signé, gardes et voisinage des seuils. `Object.is` vérifie les valeurs scalaires, pas les bits internes de payload d'un NaN. Les deux exécutions réussissent. Ce n'est pas une preuve exhaustive sur tous les flottants.

### Fonction complète : temps CPU mesurés

Deux campagnes distinctes, chacune avec 8 appels d'échauffement par variante et taille, puis 30 paires alternées A/B et B/A. Deux contextes caméra/FOV/résolution reçoivent chacun les deux ordres. Le temps externe inclut allocation du résultat, calcul, compteurs, horodatages internes et retour de fonction. Préparation des fixtures hors mesure pour A et B.

| Objets | Campagne 1 : référence → candidate, ms | Campagne 2 : référence → candidate, ms | Rapport des médianes A/B |
|---|---:|---:|---:|
| 1 000 | 0,02958 → 0,02425 | 0,03008 → 0,02333 | 1,22× / 1,29× |
| 10 000 | 0,19237 → 0,12929 | 0,18525 → 0,12496 | 1,49× / 1,48× |
| 100 000 | 1,82396 → 1,25483 | 1,90567 → 1,27233 | 1,45× / 1,50× |

À 100 000 objets, cela représente **0,569 ms et 0,633 ms de moins**, soit environ **31 % et 33 % de réduction du temps de cette fonction**. Ce ne sont pas des gains de FPS. Les intervalles bootstrap exploratoires des différences appariées sont du côté du gain dans les six séries. Ils décrivent ce processus et ce matériel ; ils ne couvrent pas les différences entre machines ou la dérive thermique à long terme.

Le second banc contient aussi `radial-hoist-tan`, un noyau avec sorties préallouées. Ses nombres ne sont pas ceux de la fonction complète et ne doivent pas être substitués au tableau ci-dessus.

## 3. Cache de borne AABB : régression lors de l'invalidation

Cette expérience compare deux **implémentations JavaScript** du noyau de la borne de projection documentée. Les boîtes en espace caméra et leur validation sont préparées hors chronométrage, de façon identique. A recalcule le facteur de projection ; B mémorise `Zmin`, le facteur avec racine par région et `fmax` par vue, puis garde l'ordre `error * fmax / Zmin * factor`. La candidate réserve **16 octets par région**, soit **1 600 000 octets pour 100 000 régions**, hors objets auxiliaires.

| 100 000 régions | Campagne 1 A → B, ms | Campagne 2 A → B, ms | Interprétation |
|---|---:|---:|---|
| Vue inchangée, cache déjà préparé | 0,88204 → 0,67912 | 0,87133 → 0,67088 | environ 23 % de temps en moins dans ce noyau |
| Cache entièrement reconstruit à chaque évaluation | 0,92017 → 1,44088 | 0,88392 → 1,42696 | environ 57 % et 61 % de temps en plus |

La préparation initiale du cas fixe coûte **0,699 ms et 0,563 ms**, mesurées séparément, et s'ajoute au résultat fixe. Le cas mobile inclut la reconstruction dans chaque échantillon. Les comparaisons à 1, 2, 8 et 32 réutilisations, disponibles dans les données brutes, montrent que l'amortissement dépend du nombre de réutilisations et de la taille. Aucun seuil portable d'activation n'est établi.

La suite commune des noyaux réussit **889 786 assertions** à chaque exécution, incluant résultats, seuils et versions d'invalidation. La validation d'entrée est partagée et extérieure aux noyaux chronométrés : ce n'est pas la preuve de deux API complètes indépendantes. La transcription JavaScript ne reproduit pas nécessairement les exceptions de dépassement de plage de Python ; elle ne prouve donc pas un remplacement de l'oracle Python. Aucun rendu n'est associé à cette variante de cache.

**Décision : cache rejeté comme remplacement général de la borne.** Le résultat fixe est conservé comme observation, sans recommandation d'intégration. Un cache dépendant de la vue exige des invalidations correctes ; supprimer ces invalidations pour obtenir un meilleur chiffre rendrait la comparaison invalide.

## 4. Contrôle visuel et cadence de la variante tangente

La scène de contrôle contient **2 000 sphères**, graine 42, trois géométries LOD consommées par trois ensembles d'instances, même matériau et même renderer pour A et B. Trois objets fixes assurent l'exercice des différents niveaux. La majorité des objets est au niveau le plus grossier. Cette scène n'exerce pas les fonctionnalités complètes de matériaux, animation, ombres, picking, streaming ou perte de contexte du futur moteur.

### Cinq cadrages, comparaison exacte A/A/B

| Cadrage | Résolution | LOD0 / LOD1 / LOD2 | Pixels différents A/B |
|---|---|---|---:|
| Référence | 640 × 360 | 1 / 1 / 1 998 | 0 |
| Caméra sur le centre d'un objet | 640 × 360 | 1 / 1 / 1 998 | 0 |
| Caméra déplacée | 640 × 360 | 0 / 11 / 1 989 | 0 |
| FOV de 38° | 640 × 360 | 1 / 7 / 1 992 | 0 |
| Résolution augmentée | 960 × 540 | 1 / 3 / 1 996 | 0 |

Pour chaque cadrage : zéro différence de valeur scalaire et d'identité LOD ; les quatre canaux de chaque pixel sont comparés. La répétition A/A donne aussi zéro différence. Les hashes des images et des entrées sont archivés. Ce contrôle représente **cinq cadrages et quinze lectures d'image** ; le même objet de résultat `quality` a été joint aux deux campagnes de cadence. Il ne s'agit pas de deux validations visuelles indépendantes. Les pixels bruts ne sont pas archivés ; le banc permet de refaire la comparaison.

### Deux campagnes de cadence en A/B/B/A

Chaque bloc suit la même trajectoire déterministe pendant **240 frames mesurées après 60 frames d'échauffement**. Aucun readback d'image n'a lieu dans cette fenêtre. L'onglet doit rester visible. À indice de trajectoire égal, les huit blocs possèdent les mêmes distributions LOD, nombres de dessins et triangles soumis ; les 2 000 instances sont consommées partout.

| Campagne / bloc | Variante | CPU total p50 / p95, ms | Intervalle rAF p50 / p95, ms |
|---|---|---:|---:|
| 1 / 1 | A | 0,20 / 0,50 | 8,30 / 9,20 |
| 1 / 2 | B | 0,20 / 0,40 | 8,30 / 8,90 |
| 1 / 3 | B | 0,20 / 0,40 | 8,30 / 9,00 |
| 1 / 4 | A | 0,20 / 0,30 | 8,30 / 9,10 |
| 2 / 1 | A | 0,20 / 0,30 | 8,30 / 9,10 |
| 2 / 2 | B | 0,20 / 0,30 | 8,30 / 8,60 |
| 2 / 3 | B | 0,20 / 0,30 | 8,30 / 9,20 |
| 2 / 4 | A | 0,20 / 0,30 | 8,30 / 9,20 |

Les quantiles de ce rapport suivent le rang d'indice zéro `floor((N-1)*p)` du banc Node ; les tableaux sont arrondis. Les frames successives sont corrélées : 1 920 frames ne constituent pas 1 920 expériences indépendantes.

Le chronométrage navigateur est quantifié autour de 0,1 ms. Une médiane à zéro pour la sélection B signifie une mesure sous cette résolution, pas un calcul gratuit. La résolution de `performance.now()` peut être réduite par le navigateur. [Documentation du timer](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now).

`cpuFrameWorkMs` mesure la préparation caméra, la sélection et la soumission du rendu CPU, pas la fin du calcul GPU. L'intervalle `rafDeltaMs` précède le travail enregistré sur la même ligne et décrit la cadence des callbacks. `requestAnimationFrame` est lié au cycle de rafraîchissement ; ce n'est pas une mesure directe de présentation physique. [Documentation de requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

**Décision : fluidité indéterminée.** Les médianes restent à 0,20 ms de travail CPU et 8,30 ms d'intervalle rAF pour A et B. Les variations des p95 ne démontrent pas une amélioration reproductible. La baisse de coût de sélection ne permet pas d'affirmer que la scène est plus fluide.

## 5. Registre d'acceptation

| Variante | Preuve de calcul plus rapide | Sorties / image | Fluidité | Décision selon les conditions cumulatives |
|---|---|---|---|---|
| Tangente une fois par appel 04B | oui, fonction CPU, sur M2 Max | sorties contrôlées et cinq cadrages identiques | non démontrée | `WATCHLIST`, aucun remplacement adopté |
| Cache AABB JavaScript | oui à vue fixe ; régression en reconstruction | contrôles numériques JS seulement | non mesurée | `REJECT` comme remplacement général |
| Comparaisons sans division/racine, cône reformulé, f32/f16/SIMD | aucune campagne recevable dans ce dossier | non validées pour remplacement | non mesurée | `not-run`, exclues des choix validés |

Ce résultat ne prouve pas que les calculs actuels sont optimaux. Il établit précisément ce qui a réussi et ce qui manque. Pour changer une décision, il faut une comparaison de la scène cible sur les machines annoncées, avec les mêmes fonctions et paramètres visuels, et un gain dépassant le bruit. Les [conditions d'intégration](PLAN_EXPERIENCES_PERFORMANCE.md) s'appliquent à chaque variante ; aucune donnée absente ne vaut succès.

## 6. Reproduire sans modifier le prototype

Les sources et les résultats sont intégrés au Markdown. Exécuter l'extracteur suivant depuis la racine du dépôt avec Python standard. Il crée un nouveau dossier temporaire, vérifie les chemins, puis adapte uniquement la configuration des chemins Vite. Les sources de calcul restent identiques aux archives. Les dépendances Three.js et Vite déjà installées dans le dépôt sont utilisées ; aucune installation automatique.

<!-- proof-extractor -->
```python
from pathlib import Path
import json
import re
import tempfile

repo = Path.cwd().resolve()
assert (repo / "docs/PREUVES_COMPARATIVES_OPTIMISATION.md").is_file()
out = Path(tempfile.mkdtemp(prefix="render-doc-proof-")).resolve()
pattern = r"<!-- proof-file: ([^\n]+) -->\n```[^\n]*\n([\s\S]*?)\n```"
seen = set()
for archive in ["sources", "mesures"]:
    text = (repo / f"docs/preuves/2026-09-11-{archive}.md").read_text()
    for name, body in re.findall(pattern, text):
        relative = Path(name)
        assert not relative.is_absolute() and ".." not in relative.parts
        assert name not in seen
        seen.add(name)
        target = out / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(body + "\n")
assert len(seen) == 14, seen
q = lambda p: json.dumps(str(p))
visual = out / "visual"
config = (
    "export default {\n"
    f"  root: {q(visual)}, cacheDir: {q(visual / '.vite-cache')},\n"
    "  resolve: { alias: [\n"
    f"    {{ find: /^three$/, replacement: {q(repo / 'node_modules/three/build/three.module.js')} }},\n"
    f"    {{ find: '@repo', replacement: {q(out)} }}\n"
    "  ] },\n"
    "  server: { host: '127.0.0.1', port: 5196, strictPort: true,\n"
    f"    fs: {{ allow: [{q(out)}, {q(repo / 'node_modules')}] }} }}\n"
    "};\n"
)
(visual / "vite.replay.config.mjs").write_text(config)
print(out)
```

Dans le dossier temporaire affiché, exécuter `node render-proof-actual.mjs` et `node render-proof-bench.mjs` pour les contrôles numériques seuls. Ajouter `--bench` pour refaire les chronométrages, en lançant les deux bancs l'un après l'autre. Node doit prendre en charge les imports TypeScript utilisés par les sources figées ; la version mesurée est indiquée plus haut. Les JSON extraits dans `results` sont les observations archivées, pas les résultats d'une nouvelle exécution.

Pour le navigateur, lancer le Vite installé dans le dépôt avec le dossier temporaire `visual` comme racine et `visual/vite.replay.config.mjs` comme configuration explicite. Ouvrir le port local 5196 puis exécuter, dans la console du navigateur :

```javascript
await proofAPI.init({ count: 2000, seed: 42 });
const quality = await proofAPI.quality();
const campaign1 = await proofAPI.runPair({ samples: 240, warmup: 60 });
const campaign2 = await proofAPI.runPair({ samples: 240, warmup: 60 });
// Copier séparément { quality, frames: campaign1 } et { quality, frames: campaign2 }.
proofAPI.dispose();
```

Ne pas exécuter les chronométrages CPU et navigateur simultanément. Conserver configuration, sorties et métadonnées de chaque nouvelle campagne. Un environnement différent doit produire ses propres mesures, sans reprendre les chiffres de cette page comme une garantie.

## 7. Vérification de la livraison documentaire

L'extraction depuis ces archives a été exécutée : les huit sources restituées sont identiques octet par octet aux fichiers mesurés. Les contrôles Node restitués réussissent à nouveau (1 492 cas et 889 786 assertions). Les 75 tests de l'oracle Python existant réussissent également, sans modification de ses formules.

Le contrôle visuel a été relancé séparément depuis la copie extraite : les cinq cadrages retrouvent les mêmes hashes d'image et zéro différence A/A et A/B. Cette vérification de reproduction ne constitue pas une troisième campagne de performance. Les chemins temporaires sont résolus avant de générer la configuration Vite pour éviter les différences entre chemins symboliques et réels sur macOS.
