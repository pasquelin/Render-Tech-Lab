# Périmètre et limites

Le backend observé est le backend d'éclairage expérimental WebGL2 du SDK Web Geometry. Le Lab appelle les API publiques de préparation et d'exploration, mais ce backend dessine la géométrie source complète et évalue des intersections analytiques de rectangles et de sphère. Les pages de clusters préparées ne sont pas la géométrie dessinée. Ce banc ne valide pas le renderer de production WebGPU ni sa parité avec WebGL2.

Le transport diffus utilise une discrétisation en patches et un échantillonnage déterministe. Les reflets et l'éclairage direct possèdent un budget fini. L'égalité des deux variantes ne prouve pas la convergence physique de cet éclairage. Les chemins spéculaires vers le transport diffus, les scènes générales, le streaming et les matériaux transparents ne sont pas couverts par cette fixture.

L'aperçu sert à observer les réactions aux changements. Il ne produit pas à lui seul un verdict de performance. Un résultat sur une seule machine, même valide, ne constitue pas une preuve sur matériel modeste. Aucune cible de 120 FPS n'est déclarée atteinte sans exécution correspondante.
