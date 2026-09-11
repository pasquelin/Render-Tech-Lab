import * as THREE from 'three';
import type { MeshInstanceDef } from '../types.ts';

/**
 * Générateur déterministe (pseudo-aléatoire sans dépendance externe)
 * garantissant que Test A et Test B reçoivent exactement la même disposition spatiale.
 */
export function createPseudoRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateTestInstances(count: number, seed: number = 42): MeshInstanceDef[] {
  const rng = createPseudoRandom(seed);
  const instances: MeshInstanceDef[] = [];

  // Répartition dans un volume sphérique étendu pour tester le frustum culling
  const spreadRadius = 160;

  for (let i = 0; i < count; i++) {
    // Coordonnées sphériques pseudo-aléatoires
    const u = rng();
    const v = rng();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = Math.cbrt(rng()) * spreadRadius;

    const sinPhi = Math.sin(phi);
    const x = r * sinPhi * Math.cos(theta);
    const y = (r * sinPhi * Math.sin(theta)) * 0.4; // aplatissement en hauteur
    const z = r * Math.cos(phi);

    const position = new THREE.Vector3(x, y, z);
    const rotation = new THREE.Euler(
      rng() * Math.PI * 2,
      rng() * Math.PI * 2,
      rng() * Math.PI * 2
    );

    // Échelle variable pour des boîtes englobantes hétérogènes
    const s = 0.8 + rng() * 1.6;
    const scale = new THREE.Vector3(s, s, s);

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion().setFromEuler(rotation);
    matrix.compose(position, quaternion, scale);

    // Sphère englobante dans l'espace monde
    // Pour une boîte ou tore unitaire, rayon max ~ s * 1.2
    const radius = s * 1.25;
    const boundingSphere = {
      center: position.clone(),
      radius: radius,
    };

    // Palette de couleur déterministe pour distinguer les objets
    const color = new THREE.Color().setHSL((i / count + 0.1) % 1.0, 0.75, 0.55);

    instances.push({
      id: i,
      position,
      rotation,
      scale,
      matrix,
      boundingSphere,
      color,
    });
  }

  return instances;
}

export function createBaseGeometry(): THREE.BufferGeometry {
  // Géométrie d'essai indexée détaillée (Sphère PBR représentative)
  return new THREE.SphereGeometry(1.0, 16, 12);
}
