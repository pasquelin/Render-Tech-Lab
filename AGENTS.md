# Instructions du Render Tech Lab

Ces règles s’appliquent à tout le dépôt, notamment à `src/components`, `src/components/ui`, `src/lab` et aux bancs `00-*` à `15-*`.

## Architecture React canonique

- Suivre la section [Composants React obligatoires d’un banc](README.md#composants-react-obligatoires-dun-banc) et les [principes du Lab](docs/PRINCIPES_DU_LAB.md). Le README décrit la surface UI commune ; `docs/PRINCIPES_DU_LAB.md` reste la source canonique de l’architecture des bancs et des règles de preuve.
- Les primitives de `src/components/ui` ne contiennent aucune donnée, règle, libellé, métrique, action ou contrôle propre à un banc. Elles rendent uniquement une structure accessible et les classes DaisyUI communes à partir de props typées.
- Les bancs et leurs adapters fournissent leurs données métier par leurs contrats publics. Ne jamais copier la configuration, les contrôles, les métriques secondaires, les actions ou le texte d’un banc dans un autre.
- Tout motif partagé passe par les composants communs : `LabSection`, `Field`, `Select`, `Input`, `Button`, `SegmentedControl`, `StatsGrid`/`StatItem`, `MetricGrid`, `StatusBadge`, `ProgressPanel`, `ActionBar`, `ReportSummary`, `EmptyState`, `LoadingState`, `ErrorState` et `ChartPanel`. Aucun banc ne recrée leur markup, leur spacing ou leur layout.
- La colonne droite suit toujours cet ordre : 1 Configuration / mode d’exécution, 2 Métriques en direct, 3 Campagne / comparaison, 4 Rapports et suivi. Les quatre métriques principales restent CPU submit, CPU frame, FPS, draw calls ; toute absence s’affiche `Non mesuré`. Les métriques propres au banc restent secondaires.

## Cycle de vie commun

- Le Dashboard 00 est une consultation sans moteur ni métriques simulées.
- Chaque banc 01–15 suit `idle → loading → running → completed | stopped | error`. À l’état initial, afficher la fiche et un seul CTA ; ne créer aucun canvas, moteur, animation, mesure ou chargement lourd avant ce clic.
- Après le clic, afficher immédiatement le chargement, puis le canvas ou la visualisation et la progression. Ne laisser aucun écran vide.
- Après succès, arrêt ou erreur, remplacer l’exécution par un résumé lisible avec l’action cohérente de relance/reprise et l’accès au rapport. Le CTA central et celui de la colonne droite utilisent le même libellé et la même action.
- Pendant l’exécution, désactiver les réglages et actions incompatibles ; seule l’action Arrêter reste disponible lorsqu’elle est réellement prise en charge.

## Vérification obligatoire

- Exécuter les tests de composants, le contrat des seize routes et `npm run validate` après toute modification de la coque ou de son modèle.
- Vérifier les routes 00–15 dans Chrome aux largeurs de référence et réduite. Contrôler les états du cycle de vie, l’absence de canvas avant lancement, l’ordre des sections et métriques, l’association label/contrôle, le responsive et l’absence de contenu provenant d’un autre banc.
- Toute nouvelle route ou tout nouveau contrôle étend ces recettes ; une simple vérification de présence ne suffit pas, les assertions négatives d’isolation métier sont obligatoires.

