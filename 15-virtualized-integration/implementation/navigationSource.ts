import * as THREE from 'three';
import {buildTriangleWorld, type Cities} from './navigation.ts';

/** The sidecar contains quantized triangles taken from opaque source geometry, without textures. */
function navigationWorldFromBinary(buffer: ArrayBuffer, bounds: THREE.Box3, cities: Cities) {
  const header = new DataView(buffer);
  if (buffer.byteLength < 36 || header.getUint8(0) !== 78 || header.getUint8(1) !== 65 ||
      header.getUint8(2) !== 86 || header.getUint8(3) !== 71 || header.getUint32(4, true) !== 1)
    throw new Error('Géométrie de navigation invalide');
  const count = header.getUint32(8, true);
  if (!count || buffer.byteLength !== 36 + count * 18) throw new Error('Taille de géométrie de navigation invalide');
  const min = new THREE.Vector3(header.getFloat32(12, true), header.getFloat32(16, true), header.getFloat32(20, true));
  const extent = new THREE.Vector3(header.getFloat32(24, true), header.getFloat32(28, true), header.getFloat32(32, true));
  if (![...min.toArray(), ...extent.toArray()].every(Number.isFinite) || extent.x <= 0 || extent.y <= 0 || extent.z <= 0)
    throw new Error('Étendue de géométrie de navigation invalide');
  const quantized = new Uint16Array(buffer, 36);
  const triangles = new Float32Array(count * 9);
  const origin = min.toArray(), scale = extent.toArray().map(value => value / 65535);
  for (let i = 0; i < triangles.length; i++) triangles[i] = origin[i % 3] + quantized[i] * scale[i % 3];
  return buildTriangleWorld(triangles, new THREE.Box3(min, min.clone().add(extent)), bounds, cities);
}

export async function loadNavigationWorld(manifestUrl: string, sourceKey: string, bounds: THREE.Box3, cities: Cities, signal: AbortSignal) {
  if (!/^[a-f0-9]{64}$/i.test(sourceKey)) throw new Error('Clé de source de navigation invalide');
  const url = new URL(`${sourceKey}/navigation.bin`, new URL(manifestUrl, window.location.origin));
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error(`Géométrie de collision indisponible pour ce modèle (HTTP ${response.status}). Préparez-la avec prepare-navigation-mesh.`);
  return navigationWorldFromBinary(await response.arrayBuffer(), bounds, cities);
}
