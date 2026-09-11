# Fixture Bistro extérieure — scène statique réelle

Cette fixture utilise **Amazon Lumberyard Bistro**, publié par Amazon Lumberyard dans l’[Open Research Content Archive (ORCA)](https://developer.nvidia.com/orca/amazon-lumberyard-bistro), 2017. L’asset est sous [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Crédit à conserver : **Amazon Lumberyard Bistro — Amazon Lumberyard, ORCA, 2017 — CC BY 4.0**. La licence originale et les conventions des textures sont archivées dans [BISTRO-LICENSE.txt](assets-tools/BISTRO-LICENSE.txt) et [BISTRO-SOURCE-README.txt](assets-tools/BISTRO-SOURCE-README.txt).

L’[archive NVIDIA officielle](https://developer.nvidia.com/bistro) contient le FBX et les textures. Seul l’extérieur est importé. Le GLB produit est disponible localement à `/benchmark-assets/bistro/bistro-exterior.glb`, avec `manifest.json` et `validation.json` à côté. Ces gros fichiers sont ignorés par Git ; une autre machine doit les préparer avant de lancer le test.

## Préparer la fixture

Prérequis : Python 3.9 ou ultérieur avec Pillow (12.2.0 utilisé localement), curl, et Blender avec import FBX / export glTF. La conversion locale a utilisé **Blender 5.2.1 LTS**, build `9e2066aef7ef`. Depuis la racine du dépôt :

```sh
bash 14-open-world/assets-tools/prepare_bistro.sh
```

`BLENDER_BIN` peut désigner un autre chemin vers Blender ; `BISTRO_CACHE` peut désigner un dossier de cache. Le script télécharge environ 853 MiB, vérifie le SHA-256 attendu, contrôle tous les chemins ZIP avant d’extraire l’extérieur et les textures, puis convertit en CPU. Il ne lance aucun rendu ni benchmark. Les fichiers extraits occupent environ 1,60 Go, auxquels s’ajoutent l’archive et le GLB de 1,10 Go. Pillow sert uniquement à contrôler l’alpha des PNG embarqués ; le post-traitement ne les recomprime pas.

La recette et la source sont identifiées par leurs empreintes ; la stabilité octet par octet du GLB entre versions de Blender n’est pas garantie. La conversion écrit les empreintes exactes réellement produites dans son manifeste. Pour inspecter le résultat sans décoder les textures :

```sh
python3 14-open-world/assets-tools/inspect_glb.py public/benchmark-assets/bistro/bistro-exterior.glb
```

## Transformations déclarées

- Géométrie entière importée, sans décimation. Le script vérifie que le nombre de triangles du GLB égale celui des objets importés dans Blender.
- Fixture **statique à la frame 1** : la source contient 16 actions importées, notamment le vent des lanternes et des guirlandes. Les clips ne sont pas exportés. Les variantes du benchmark reçoivent la même pose statique ; elles ne comparent pas l’animation.
- Conversion des axes Blender vers glTF Y-up, sans normalisation supplémentaire de la scène dans la recette. L’import Blender indique unités métriques, facteur 1. La page peut appliquer une translation ou une échelle uniforme déclarée dans ses résultats.
- Les matériaux importés étaient tous marqués `BLEND`, y compris les surfaces opaques. Le post-traitement `normalize_opaque_materials.py` marque `OPAQUE` uniquement un matériau dont le facteur alpha vaut exactement 1 et dont tous les pixels de la texture de couleur ont un alpha de 255 (ou qui n’a pas cette texture). Il refuse les couleurs de sommets, qui exigeraient une preuve d’alpha supplémentaire. **120 matériaux deviennent opaques, 12 restent BLEND**, avec leurs valeurs alpha originales. Les 132 indicateurs `doubleSided` sont conservés.
- Cette correction des indicateurs de conversion définit la fixture commune des futures variantes A/B. Elle ne constitue pas une optimisation mesurée contre une bonne référence d’origine.
- Les textures `_Specular` sont interprétées selon le README source : R = occlusion, G = rugosité, B = métal. Elles ne sont pas traitées comme de simples cartes spéculaires.
- Les normales DirectX sont converties vers la convention glTF en inversant le vert. Aucune texture n’est redimensionnée ; les DDS sont décodées puis embarquées en PNG. Les connexions base couleur, opacité et émission importées sont conservées. Le HDR d’environnement Falcor et les caméras/lumières FBX ne sont pas exportés.

Il s’agit d’une adaptation des matériaux au pipeline glTF, pas d’une preuve de parité pixel avec le rendu Falcor d’origine. Les avertissements Blender relatifs à plusieurs nœuds partageant une texture ont été observés ; le GLB final possède un seul sampler (filtrage linéaire avec mipmaps).

## Résultat local vérifié

| Donnée | Valeur |
| --- | ---: |
| Archive | 894 377 473 octets |
| FBX extérieur | 119 845 216 octets |
| Triangles annoncés par ORCA | 2 832 120 |
| Triangles importés puis exportés | **2 829 226** |
| Sommets des meshes importés | 2 077 661 |
| Meshes / nœuds mesh glTF | 1 296 / 1 296 |
| Matériaux glTF | 132 : 120 OPAQUE, 12 BLEND |
| Images PNG embarquées | 405 |
| Animations / skins glTF | 0 / 0 |
| GLB statique | 1 100 856 892 octets |

L’écart de **2 894 triangles** entre le compteur public et l’import est signalé, sans attribution certaine à une version ou à une opération d’import. La conservation est vérifiée **de l’import Blender au GLB**, pas du compteur marketing au résultat. Les nombres de meshes/images uniques décrivent l’import obtenu et ne prétendent pas reproduire la déduplication du moteur Falcor.

Dimensions des images du GLB : 224 de 2048×2048, 153 de 16×16, 8 de 64×64 et 20 de 1×1. Leur total en RGBA décodé serait **3 758 384 208 octets hors mipmaps** : c’est une estimation arithmétique, pas une mesure de mémoire GPU. Le chargement initial est donc substantiel et doit être distingué des mesures de frames stabilisées.

Bornes de la pose importée, dans les axes glTF : minimum `[-62.458248, -7.561876, -87.936989]`, maximum `[111.301956, 43.532352, 96.481483]`. Le minimum Y comprend des parties sous la rue ; il ne constitue pas une hauteur de chaussée pour placer la caméra.

| Fichier | SHA-256 |
| --- | --- |
| Bistro_v5_2.zip | `0d50e3c724c6c5da19f8eb99ad3f53e36fec37ffa2df9621f9ccf0603f3934e1` |
| BistroExterior.fbx | `471991629c7e35a88338c48f3565390ad19cc5d1d7c7e067fc2a60b4f3b5f195` |
| bistro-exterior.glb statique | `cd520e4a2f963d7b4c1fe6313e106d012080c166ee5817c924159c5e829218d2` |

Le GLB avant correction alpha avait l’empreinte `e02706073a846a55fdd91f16d79487ea8c48df8d09d2ffe18ed40d2cbae8e080`. Le post-traitement modifie uniquement `alphaMode` dans le JSON puis réécrit son enveloppe GLB. Les **1 098 909 232 octets du bloc binaire** (géométrie et images comprises) sont copiés puis relus et hachés : SHA-256 identique avant/après `922441c8b97525c28a012a0d4907f221be32228b188323f57cdc2d4546c9956a`. Une deuxième application est idempotente : le GLB conserve exactement son empreinte corrigée. Le manifeste conserve les décisions par matériau et l’historique de cette vérification.

La présence de cet asset ne démontre aucun gain de vitesse : les résultats du benchmark doivent préciser la machine, le cadrage, la taille de rendu, les paramètres et la vérification de l’image entre variantes.
