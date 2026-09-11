/**
 * shared/scene/types.ts
 *
 * Types communs du générateur de scène déterministe.
 *
 * Ces types sont volontairement agnostiques de Three.js : les bancs projettent
 * ces structures vers Three.js (Test A) ou vers des buffers plats WebGPU (Test B)
 * selon leur architecture, sans que le générateur impose un choix.
 */

export interface SceneConfig {
  /** Graine explicite : garantit la reproductibilité bit-à-bit. */
  seed: number;
  /** Nombre total d'objets de la scène (instances). */
  objectCount: number;
  /** Nombre de géométries uniques disponibles (topologies). */
  geometryCount: number;
  /** Nombre de matériaux uniques disponibles. */
  materialCount: number;
  /** Taille du volume d'échantillonnage (unité monde). Défaut : 100. */
  spread?: number;
}

export interface SceneObject {
  /** Index stable de l'objet dans la scène (0-based). */
  id: number;
  /** Position en unités monde sur les axes x/y/z. */
  position: [number, number, number];
  /** Échelle uniforme de l'objet. */
  scale: number;
  /** Index de géométrie attribuée (index dans la palette). */
  geometryId: number;
  /** Index de matériau attribué (index dans la palette). */
  materialId: number;
  /** Diamètre englobant de l'objet (utile pour SSE / culling). */
  boundingDiameter: number;
}

export interface GeneratedScene {
  /** Graine effectivement utilisée. */
  seed: number;
  /** Objets distribués de façon déterministe. */
  objects: SceneObject[];
  /** Nombre de géométries uniques. */
  geometryCount: number;
  /** Nombre de matériaux uniques. */
  materialCount: number;
}
