import { MODULE_DESCRIPTORS } from './modules.ts';

/** Read presentation directly from the selected module, never a copied snapshot. */
export function moduleDescription(moduleId: string): string {
  if (moduleId === '00-baseline') return 'Mesure de référence utilisée pour comparer tous les autres bancs. Implémentation actuelle : Three.js WebGL.';
  if (moduleId === '14-open-world') {
    return 'Rendu Three.js WebGL2 résident : une scène Bistro répétée en quartiers mesure la pression de rendu et de culling, avec la géométrie déjà chargée en mémoire. Ce banc ne met pas en œuvre de géométrie virtualisée de type Nanite.';
  }
  if (moduleId === '15-virtualized-integration') return 'Fixture procédurale validée : comparaison A/B, clusters hiérarchiques, sélection WebGPU, dessin indirect, pages, cache et évictions. Les modèles préparés sont accessibles en exploration libre ; la comparaison complète reste bloquée par le contrôle A/A.';
  return MODULE_DESCRIPTORS[moduleId]?.description ?? '';
}
