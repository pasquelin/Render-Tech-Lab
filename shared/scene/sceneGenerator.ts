/**
 * shared/scene/sceneGenerator.ts
 *
 * Générateur de scène déterministe et reproductible.
 *
 * Règle de gouvernance : une même `SceneConfig` (notamment la `seed`) DOIT
 * produire exactement la même `GeneratedScene` dans tous les bancs. Aucune
 * génération procédurale complexe : simple distribution régulière + aléatoire
 * graine, volontairement élémentaire et lisible.
 */

import { createSeededRandom } from './random.ts';
import type { GeneratedScene, SceneConfig, SceneObject } from './types.ts';

/** Graine canonique du laboratoire (réutilisable par tous les bancs). */
export const DEFAULT_SEED = 1337;

/**
 * Génère une scène déterministe à partir d'une configuration.
 *
 * La distribution des objets est régulière (grille 3D) avec un léger jitter
 * aléatoire graine, pour rester lisible et reproductible sans procédural coûteux.
 */
export function createScene(config: SceneConfig): GeneratedScene {
  const rng = createSeededRandom(config.seed);
  const objectCount = Math.max(0, Math.floor(config.objectCount));
  const geometryCount = Math.max(1, Math.floor(config.geometryCount));
  const materialCount = Math.max(1, Math.floor(config.materialCount));
  const spread = config.spread ?? 100;

  const objects: SceneObject[] = [];

  // Grille 3D : nombre d'objets par axe, arrondi supérieur, pour couvrir le total.
  const perAxis = Math.max(1, Math.ceil(Math.cbrt(objectCount)));
  let id = 0;

  for (let ix = 0; ix < perAxis && id < objectCount; ix++) {
    for (let iy = 0; iy < perAxis && id < objectCount; iy++) {
      for (let iz = 0; iz < perAxis && id < objectCount; iz++) {
        if (id >= objectCount) break;

        // Position régulière centrée, + jitter déterministe (≤ 10 % de l'espacement).
        const spacing = spread / perAxis;
        const jitter = () => (rng() - 0.5) * spacing * 0.2;
        const x = (ix - (perAxis - 1) / 2) * spacing + jitter();
        const y = (iy - (perAxis - 1) / 2) * spacing + jitter();
        const z = (iz - (perAxis - 1) / 2) * spacing + jitter();

        // Attributs de palette déterministes mais non constants.
        const geometryId = id % geometryCount;
        const materialId = id % materialCount;

        const scale = 0.5 + rng() * 1.0; // [0.5 ; 1.5]
        const boundingDiameter = 2.0 * scale;

        objects.push({
          id,
          position: [x, y, z],
          scale,
          geometryId,
          materialId,
          boundingDiameter,
        });
        id++;
      }
    }
  }

  return {
    seed: config.seed,
    objects,
    geometryCount,
    materialCount,
  };
}
