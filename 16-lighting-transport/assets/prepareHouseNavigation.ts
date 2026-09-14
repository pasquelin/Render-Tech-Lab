// Écrit cache/house/native/full/<clé>/navigation.bin : la géométrie de collision de la maison, au
// format binaire NAVG v1 que lit sans modification 15-virtualized-integration/implementation/
// navigationSource.ts (navigationWorldFromBinary) — le composant de navigation à la première personne
// du banc 15, réutilisé tel quel par src/components/LightingLab.tsx. Ce script ne réimplémente aucun
// algorithme de collision : il transforme les boîtes murs/sol de house.ts (déjà connues, axis-aligned)
// en triangles quantifiés, exactement le rôle que joue prepare-navigation-mesh.ts pour un modèle importé.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Vec3 = [number, number, number];
interface Box { min: Vec3; max: Vec3 }
interface NavigationSource { boxes: Box[] }
interface CacheManifest { key: string }

const HERE = fileURLToPath(new URL('.', import.meta.url));
const NAVIGATION_SOURCE = resolve(HERE, 'source/house-navigation.json');
const CACHE_MANIFEST = resolve(HERE, 'cache/house/native/full/manifest.json');

/** Six faces (deux triangles chacune) d'une boîte axis-aligned ; l'ordre des sommets n'importe pas
 * pour la collision (aucun test de face avant/arrière ici, seulement des distances aux arêtes). */
function boxTriangles(box: Box): Vec3[][] {
  const { min, max } = box;
  const corners: Vec3[] = [
    [min[0], min[1], min[2]], [max[0], min[1], min[2]], [max[0], min[1], max[2]], [min[0], min[1], max[2]],
    [min[0], max[1], min[2]], [max[0], max[1], min[2]], [max[0], max[1], max[2]], [min[0], max[1], max[2]],
  ];
  const faces: [number, number, number, number][] = [
    [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [3, 0, 4, 7],
  ];
  const triangles: Vec3[][] = [];
  for (const [a, b, c, d] of faces) {
    triangles.push([corners[a], corners[b], corners[c]]);
    triangles.push([corners[a], corners[c], corners[d]]);
  }
  return triangles;
}

const { boxes } = JSON.parse(await readFile(NAVIGATION_SOURCE, 'utf8')) as NavigationSource;
const manifest = JSON.parse(await readFile(CACHE_MANIFEST, 'utf8')) as CacheManifest;
if (!/^[a-f0-9]{64}$/i.test(manifest.key)) throw new Error('Clé de cache invalide');
const outputFile = resolve(HERE, 'cache/house/native/full', manifest.key, 'navigation.bin');

const triangles = boxes.flatMap(boxTriangles);
if (!triangles.length) throw new Error('Aucun triangle de collision');

const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
for (const triangle of triangles) for (const point of triangle) for (let axis = 0; axis < 3; axis++) {
  min[axis] = Math.min(min[axis], point[axis]);
  max[axis] = Math.max(max[axis], point[axis]);
}
const extent: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];

const header = Buffer.alloc(36);
header.write('NAVG', 0, 'ascii');
header.writeUInt32LE(1, 4);
header.writeUInt32LE(triangles.length, 8);
for (let axis = 0; axis < 3; axis++) { header.writeFloatLE(min[axis], 12 + axis * 4); header.writeFloatLE(extent[axis], 24 + axis * 4); }

const body = Buffer.alloc(triangles.length * 18);
for (let i = 0; i < triangles.length; i++) {
  for (let v = 0; v < 3; v++) for (let axis = 0; axis < 3; axis++) {
    const value = triangles[i][v][axis];
    const quantized = Math.max(0, Math.min(65535, Math.round(((value - min[axis]) / (extent[axis] || 1)) * 65535)));
    body.writeUInt16LE(quantized, i * 18 + v * 6 + axis * 2);
  }
}
await writeFile(outputFile, Buffer.concat([header, body]));
console.log(`Navigation de la maison écrite : ${outputFile} (${triangles.length} triangles de collision)`);
