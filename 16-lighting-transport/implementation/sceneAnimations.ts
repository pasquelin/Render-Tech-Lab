import * as THREE from 'three';
import type { SceneId, SceneLight, Vec3 } from '../contracts.ts';
import { EMERALD_CAR_LOOP, EMERALD_STREETLIGHTS, EMERALD_STREETLIGHT_HEAD_OFFSET_M } from './emeraldFixtures.ts';

/** Un nœud animé : mémoire réutilisée (position/quaternion), jamais réallouée à chaque image. */
export interface AnimatedNode {
  readonly name: string;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  advance(timeSeconds: number, speed: number): void;
}

function node(name: string, base: Vec3, advance: (t: number, out: THREE.Vector3, quat: THREE.Quaternion, base: THREE.Vector3) => void): AnimatedNode {
  const position = new THREE.Vector3(...base);
  const quaternion = new THREE.Quaternion();
  const basePosition = position.clone();
  return { name, position, quaternion, advance(timeSeconds: number, speed: number) { advance(timeSeconds * speed, position, quaternion, basePosition); } };
}

const UP = new THREE.Vector3(0, 1, 0);
const swing = (min: number, max: number, t: number, periodSeconds: number) => {
  const phase = (Math.sin((t * Math.PI * 2) / periodSeconds) + 1) / 2;
  return min + (max - min) * phase;
};

/** Position du gond = doorCenter + openingSign × DOOR_WIDTH/2 (mêmes constantes que house.mjs) ;
 * la porte pivote sur ce bord, jamais sur le centre de l'ouverture. */
const DOOR_WIDTH = 1.2;
const doorHingeX = (doorCenter: number, openingSign: 1 | -1) => doorCenter + openingSign * (DOOR_WIDTH / 2);

/** Les huit repères animés de la maison de test, pose de repos = house.mjs. Chaque door-N est un
 * gond : seule sa rotation Y change, sa position reste celle de l'arête verticale de l'ouverture. */
export function createHouseAnimatedNodes(): AnimatedNode[] {
  return [
    node('door-1', [doorHingeX(-10, -1), 0, 2], (t, _pos, quat) => quat.setFromAxisAngle(UP, swing(0, Math.PI / 2, t, 6))),
    node('door-2', [doorHingeX(10, 1), 0, 2], (t, _pos, quat) => quat.setFromAxisAngle(UP, -swing(0, Math.PI / 2, t + 1.5, 6))),
    node('door-3', [doorHingeX(-10, -1), 0, -2], (t, _pos, quat) => quat.setFromAxisAngle(UP, swing(0, Math.PI / 2, t + 3, 6))),
    node('door-4', [doorHingeX(10, 1), 0, -2], (t, _pos, quat) => quat.setFromAxisAngle(UP, -swing(0, Math.PI / 2, t + 4.5, 6))),
    node('fan', [0, 3, 0], (t, _pos, quat) => quat.setFromAxisAngle(UP, t * 6)),
    node('panel', [-0.05, 0, 8], (t, pos, _quat, base) => pos.set(base.x + swing(0, 1, t, 8), base.y, base.z)),
    node('lamp-mobile', [-6, 2.4, 0], (t, pos, _quat, base) => { pos.set(base.x + swing(-3, 3, t, 10), base.y + Math.sin(t * 1.3) * 0.15, base.z); }),
    node('mirror-turning', [-10, 0, -8], (t, _pos, quat) => quat.setFromAxisAngle(UP, t * 0.8)),
  ];
}

const carDirection = new THREE.Vector3();
const carLoopPoint = (t: number, out: THREE.Vector3) => {
  const points = EMERALD_CAR_LOOP;
  const segments = points.length - 1;
  const lengths = [];
  let total = 0;
  for (let i = 0; i < segments; i++) {
    const a = points[i], b = points[i + 1];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    lengths.push(length);
    total += length;
  }
  let distance = ((t % 1) + 1) % 1 * total;
  let index = 0;
  while (index < segments - 1 && distance > lengths[index]) { distance -= lengths[index]; index++; }
  const a = points[index], b = points[index + 1];
  const fraction = lengths[index] > 0 ? distance / lengths[index] : 0;
  out.set(a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction, a[2] + (b[2] - a[2]) * fraction);
  carDirection.set(b[0] - a[0], 0, b[2] - a[2]).normalize();
};

/** Pose courante de la voiture (période 24 s à vitesse ×1), utilisée pour faire suivre les deux
 * phares (spots) à la scène Emerald — la voiture elle-même n'a pas de canvas dédié (voir le rapport). */
export function carHeadlightPoses(timeSeconds: number, speed: number): { position: Vec3; direction: Vec3 }[] {
  const t = (timeSeconds * speed) / 24;
  const position = new THREE.Vector3();
  carLoopPoint(t, position);
  const forward = carDirection.clone();
  const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
  const offsets = [-0.7, 0.7];
  return offsets.map(offset => ({
    position: [position.x + right.x * offset, position.y + 0.55, position.z + right.z * offset] as Vec3,
    direction: [forward.x, -0.08, forward.z] as Vec3,
  }));
}

/** Emplacement automatique des lampes (curseur 1-30) : grille dans les pièces pour la maison,
 * lampadaires réels (puis grille de secours) pour Emerald. Quand un point de vue est donné, les
 * lampadaires retenus sont les plus proches de lui : la rue où l'on arrive est celle qu'on allume,
 * sans qu'aucune coordonnée de scène soit écrite ici. */
export function autoLightPositions(scene: SceneId, count: number, origin?: Vec3): Vec3[] {
  if (scene === 'emerald-night') {
    const heads = EMERALD_STREETLIGHTS.map(entry => [entry.position[0], entry.position[1] + EMERALD_STREETLIGHT_HEAD_OFFSET_M, entry.position[2]] as Vec3);
    if (!origin) return heads.slice(0, count);
    const groundDistance2 = (point: Vec3) => (point[0] - origin[0]) ** 2 + (point[2] - origin[2]) ** 2;
    return [...heads].sort((a, b) => groundDistance2(a) - groundDistance2(b)).slice(0, count);
  }
  const rooms: Vec3[] = [[-10, 2.6, 8], [10, 2.6, 8], [-10, 2.6, -8], [10, 2.6, -8]];
  const positions: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const room = rooms[i % rooms.length];
    const ring = Math.floor(i / rooms.length);
    const angle = (i * 2.4) % (Math.PI * 2);
    const radius = 1.5 + ring * 1.2;
    positions.push([room[0] + Math.cos(angle) * radius, room[1], room[2] + Math.sin(angle) * radius]);
  }
  return positions;
}

/** Vague allumée/éteinte des lampes automatiques (exigence « lumières qui s'allument et s'éteignent »),
 * indépendante des trois lampes réglables à la main. */
export function autoLightOnOff(index: number, timeSeconds: number, speed: number): boolean {
  return Math.sin(timeSeconds * speed * 1.5 - index * 0.6) > 0;
}

export function buildAutoLights(scene: SceneId, count: number, baseColor: Vec3, baseIntensity: number, range: number, castsShadow: boolean, origin?: Vec3): SceneLight[] {
  return autoLightPositions(scene, count, origin).map((position, index) => ({
    id: `auto-${index}`,
    kind: 'point',
    position,
    color: baseColor,
    intensity: baseIntensity,
    range,
    castsShadow: castsShadow && index < 4,
  }));
}
