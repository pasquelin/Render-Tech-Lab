import type { EngineCapabilities } from '../contracts.ts';

/** Détecte ce que l'Explorer actif expose réellement, sans jamais supposer le contrat du moteur.
 * Une présence de méthode ne garantit pas qu'un appel précis réussira (setTransform refuse un nom
 * de nœud absent de la scène préparée par un EngineError nommé, propre à ce nœud, pas au contrat) ;
 * le runner absorbe ces refus nœud par nœud sans désactiver la capacité entière. */
export function detectEngineCapabilities(explorer: unknown): EngineCapabilities {
  const owned = explorer as Record<string, unknown>;
  return {
    addLight: typeof owned.addLight === 'function',
    setLight: typeof owned.setLight === 'function',
    removeLight: typeof owned.removeLight === 'function',
    setLightingView: typeof owned.setLightingView === 'function',
    setTransform: typeof owned.setTransform === 'function',
  };
}

export function inactiveCapabilityKeys(capabilities: EngineCapabilities): (keyof EngineCapabilities)[] {
  return (Object.keys(capabilities) as (keyof EngineCapabilities)[]).filter(key => !capabilities[key]);
}
