# 16 · Lumière

Ce banc héberge la scène d'éclairage expérimentale du SDK Web Geometry : deux pièces, trois sources colorées mobiles, une porte, deux miroirs et une sphère brillante. La route du Lab est `/?test=16-lighting-transport`.

La comparaison porte sur le parcours exhaustif des obstacles et sa variante par hiérarchie spatiale. La scène, les matériaux, les rayons, les échantillons d'ombre et la résolution restent identiques. Les images A/A puis A/B doivent être exactement identiques avant les mesures comparatives.

L'entrée publique est [`index.ts`](index.ts). Elle expose les métadonnées et contrats sans charger le moteur ; les fonctions de lancement chargent le runner à la demande. Le banc utilise les exports publics du SDK. Il ne reproduit pas ses algorithmes.

- [Hypothèse](docs/hypothesis.md)
- [Protocole et mesures](docs/protocol.md)
- [Périmètre et limites](docs/limits.md)
- [Intégration dans le Lab](docs/migration.md)

Aucune mesure de performance n'est déduite de l'enregistrement de ce banc. Le moteur observé est celui que le panneau de droite laisse choisir, WebGPU ou WebGL2 ; le bandeau de la vue nomme celui qui tourne réellement.
