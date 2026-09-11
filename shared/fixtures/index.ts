/**
 * shared/fixtures/index.ts
 *
 * Point d'entrée canonique des maillages témoins du laboratoire.
 * Tous les bancs (05→13) doivent importer par ici pour garantir l'identité
 * des données géométriques entre baseline CPU et prototype GPU.
 */

export type { TriangleMesh } from './types.ts';
export { createTriangleMesh } from './triangle.ts';
export { createQuadMesh } from './quad.ts';
export { createCubeMesh } from './cube.ts';
export { createSphereMesh } from './sphere.ts';
export type { SphereOptions } from './sphere.ts';
export { createStressMesh } from './stress.ts';
export type { StressMeshOptions } from './stress.ts';
