# Intégration Three.js et Electron — laboratoire

Partie laboratoire : protocoles, recettes ou suivi documentaire. La conception du produit est conservée dans [Web Geometry](../../webGeometry/docs/integration/INTEGRATION_THREEJS_ELECTRON.md). Les numéros historiques des sections sont conservés.

## 8. Passage du laboratoire au moteur

Chaque banc 00–13 fournit entrée déterministe, référence, variante, correction, mesures brutes et verdict. Le banc 13 assemble uniquement les variantes qui passent leurs tests séparés. Partager ensuite contrats, validateur et fixtures entre laboratoire et moteur pour éviter deux interprétations du format.

Gates d'intégration : même rendu et qualité, fallback fonctionnel, import annulable, sélection/picking corrects, ombres, export, fermeture/rechargement, device loss et budgets respectés. Les performances restent `not-run` tant que cette campagne n'est pas exécutée.
