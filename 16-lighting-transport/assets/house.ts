#!/usr/bin/env node
// Génère la maison de test du banc 16 : quatre pièces et un couloir sur 40 × 30 m.
// Écrit un GLB autonome (géométrie + matériaux, aucune texture) via glbBuilder.ts.
// Ce script fabrique du contenu 3D ordinaire (boîtes, une sphère) ; il n'implémente
// aucun algorithme de rendu ou d'éclairage — ceux-ci restent dans le SDK.
//
// Il écrit aussi source/house-navigation.json : les boîtes des murs/sol/plafond, en clair, pour que
// prepareHouseNavigation.ts (même dossier) les convertisse en triangles de collision au format que lit
// sans modification 15-virtualized-integration/implementation/navigationSource.ts. Les objets décoratifs
// (portes, ventilateur, miroirs, sphère, lampe) n'y entrent pas : ce ne sont pas des obstacles de marche.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGlbBuilder, quatFromAxisAngle, type Vec3 } from './glbBuilder.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT_FILE = resolve(HERE, 'source/house.glb');
const NAVIGATION_FILE = resolve(HERE, 'source/house-navigation.json');

const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.2;
const DOOR_WIDTH = 1.2;
const DOOR_HEIGHT = 2.2;

const builder = createGlbBuilder();
const roots: number[] = [];
const navigationBoxes: { min: Vec3; max: Vec3 }[] = [];

// --- Matériaux : un mur rouge vif exigé par le protocole, les autres pièces se distinguent par la couleur. ---
const materials = {
  floor: builder.addMaterial({ name: 'floor', baseColorFactor: [0.55, 0.53, 0.5, 1], roughnessFactor: 0.95 }),
  ceiling: builder.addMaterial({ name: 'ceiling', baseColorFactor: [0.92, 0.92, 0.9, 1], roughnessFactor: 0.9 }),
  corridorWall: builder.addMaterial({ name: 'corridor-wall', baseColorFactor: [0.85, 0.8, 0.68, 1], roughnessFactor: 0.85 }),
  roomAWall: builder.addMaterial({ name: 'room-a-wall', baseColorFactor: [0.25, 0.45, 0.75, 1], roughnessFactor: 0.85 }),
  roomBWall: builder.addMaterial({ name: 'room-b-wall', baseColorFactor: [0.3, 0.6, 0.35, 1], roughnessFactor: 0.85 }),
  roomCWall: builder.addMaterial({ name: 'room-c-wall', baseColorFactor: [0.65, 0.55, 0.2, 1], roughnessFactor: 0.85 }),
  roomDWall: builder.addMaterial({ name: 'room-d-wall-red', baseColorFactor: [0.85, 0.06, 0.06, 1], roughnessFactor: 0.7 }),
  door: builder.addMaterial({ name: 'door', baseColorFactor: [0.4, 0.26, 0.15, 1], roughnessFactor: 0.6 }),
  fan: builder.addMaterial({ name: 'fan', baseColorFactor: [0.15, 0.15, 0.17, 1], metallicFactor: 0.5, roughnessFactor: 0.4 }),
  panel: builder.addMaterial({ name: 'panel', baseColorFactor: [0.72, 0.6, 0.42, 1], roughnessFactor: 0.55 }),
  lampMobile: builder.addMaterial({ name: 'lamp-mobile', baseColorFactor: [0.95, 0.85, 0.5, 1], emissiveFactor: [0.6, 0.5, 0.15], roughnessFactor: 0.4 }),
  mirror: builder.addMaterial({ name: 'mirror', baseColorFactor: [0.9, 0.9, 0.92, 1], metallicFactor: 1, roughnessFactor: 0.05 }),
  sphere: builder.addMaterial({ name: 'sphere-shiny', baseColorFactor: [0.9, 0.75, 0.25, 1], metallicFactor: 0.9, roughnessFactor: 0.12 }),
  pedestal: builder.addMaterial({ name: 'pedestal', baseColorFactor: [0.35, 0.35, 0.37, 1], roughnessFactor: 0.8 }),
  twin: builder.addMaterial({ name: 'twin', baseColorFactor: [0.15, 0.55, 0.55, 1], roughnessFactor: 0.5 }),
  slitFrame: builder.addMaterial({ name: 'slit-frame', baseColorFactor: [0.1, 0.1, 0.12, 1], roughnessFactor: 0.7 }),
  hiddenRoom: builder.addMaterial({ name: 'hidden-room', baseColorFactor: [0.5, 0.15, 0.55, 1], roughnessFactor: 0.85 }),
};

const boxMesh = (materialIndex: number, name?: string) => builder.addMesh('box', materialIndex, name);
const sphereMesh = (materialIndex: number, name?: string) => builder.addMesh('sphere', materialIndex, name);

/** Ajoute une boîte au monde ET à la géométrie de collision (murs/sol/plafond seulement : les objets
 * décoratifs passent par builder.addNode directement et n'entrent jamais dans navigationBoxes). */
function plainBox(name: string, mesh: number, translation: Vec3, scale: Vec3, collidable = true): void {
  roots.push(builder.addNode({ name, mesh, translation, scale }));
  if (!collidable) return;
  navigationBoxes.push({
    min: [translation[0] - scale[0] / 2, translation[1], translation[2] - scale[2] / 2],
    max: [translation[0] + scale[0] / 2, translation[1] + scale[1], translation[2] + scale[2] / 2],
  });
}

interface WallWithDoorOptions { axis: 'x' | 'z'; fixedCoord: number; from: number; to: number; materialWallMesh: number; doorCenter: number; prefix: string }
/** Mur droit avec une ouverture de porte : deux montants + un linteau, la porte elle-même est un nœud séparé. */
function wallWithDoor({ axis, fixedCoord, from, to, materialWallMesh, doorCenter, prefix }: WallWithDoorOptions): void {
  const doorHalf = DOOR_WIDTH / 2;
  const segments = [
    { from, to: doorCenter - doorHalf },
    { from: doorCenter + doorHalf, to },
  ];
  for (const [index, segment] of segments.entries()) {
    const segmentLength = segment.to - segment.from;
    if (segmentLength <= 0.01) continue;
    const center = (segment.from + segment.to) / 2;
    if (axis === 'x') plainBox(`${prefix}-jamb-${index}`, materialWallMesh, [center, 0, fixedCoord], [segmentLength, WALL_HEIGHT, WALL_THICKNESS]);
    else plainBox(`${prefix}-jamb-${index}`, materialWallMesh, [fixedCoord, 0, center], [WALL_THICKNESS, WALL_HEIGHT, segmentLength]);
  }
  const lintelHeight = WALL_HEIGHT - DOOR_HEIGHT;
  if (axis === 'x') plainBox(`${prefix}-lintel`, materialWallMesh, [doorCenter, DOOR_HEIGHT, fixedCoord], [DOOR_WIDTH, lintelHeight, WALL_THICKNESS]);
  else plainBox(`${prefix}-lintel`, materialWallMesh, [fixedCoord, DOOR_HEIGHT, doorCenter], [WALL_THICKNESS, lintelHeight, DOOR_WIDTH]);
}

interface PlainWallOptions { axis: 'x' | 'z'; fixedCoord: number; from: number; to: number; materialWallMesh: number; name: string }
function plainWall({ axis, fixedCoord, from, to, materialWallMesh, name }: PlainWallOptions): void {
  const length = to - from;
  const center = (from + to) / 2;
  if (axis === 'x') plainBox(name, materialWallMesh, [center, 0, fixedCoord], [length, WALL_HEIGHT, WALL_THICKNESS]);
  else plainBox(name, materialWallMesh, [fixedCoord, 0, center], [WALL_THICKNESS, WALL_HEIGHT, length]);
}

/** Porte articulée sur le gond (bord vertical de l'ouverture, au sol) : l'origine du nœud door-N EST
 * le gond, pas le centre de l'ouverture. Le vantail est un enfant décalé de DOOR_WIDTH depuis cette
 * origine, fermé = plaqué exactement dans l'ouverture du mur. Tourner le nœud autour de Y pivote le
 * vantail sur ce bord, jamais sur son propre centre. */
function hingedDoor(name: string, doorCenter: number, fixedZ: number, openingSign: 1 | -1): void {
  const hingeX = doorCenter + openingSign * (DOOR_WIDTH / 2);
  const doorMesh = boxMesh(materials.door, 'door-leaf');
  const leaf = builder.addNode({ name: `${name}-leaf`, mesh: doorMesh, translation: [-openingSign * DOOR_WIDTH / 2, 0, 0], scale: [DOOR_WIDTH, DOOR_HEIGHT, 0.06] });
  const hinge = builder.addNode({ name, translation: [hingeX, 0, fixedZ], children: [leaf] });
  roots.push(hinge);
}

// --- Sol et plafond : une dalle par pièce/couloir pour rester dans le budget mais garder les 40 × 30 m. ---
plainBox('floor', boxMesh(materials.floor, 'floor'), [0, -0.05, 0], [40, 0.1, 32]);
plainBox('ceiling', boxMesh(materials.ceiling, 'ceiling'), [0, WALL_HEIGHT + 0.05, 0], [40, 0.1, 32], false);

// --- Murs extérieurs (périmètre 40 × 30, hors petite pièce cachée derrière la fente). ---
plainWall({ axis: 'z', fixedCoord: -20, from: -15, to: 15, materialWallMesh: boxMesh(materials.corridorWall, 'wall-west'), name: 'wall-west' });
plainWall({ axis: 'z', fixedCoord: 20, from: -15, to: 15, materialWallMesh: boxMesh(materials.corridorWall, 'wall-east'), name: 'wall-east' });
plainWall({ axis: 'x', fixedCoord: 15, from: -20, to: 20, materialWallMesh: boxMesh(materials.corridorWall, 'wall-north'), name: 'wall-north' });
// Mur sud avec la fente (voir plus bas) : deux segments encadrant une fine ouverture à x=6.
plainWall({ axis: 'x', fixedCoord: -15, from: -20, to: 5.9, materialWallMesh: boxMesh(materials.roomDWall, 'wall-south-a'), name: 'wall-south-a' });
plainWall({ axis: 'x', fixedCoord: -15, from: 6.1, to: 20, materialWallMesh: boxMesh(materials.roomDWall, 'wall-south-b'), name: 'wall-south-b' });

// --- Murs intérieurs séparant les quatre pièces du couloir central (largeur 4 m, z ∈ [-2, 2]). ---
wallWithDoor({ axis: 'x', fixedCoord: 2, from: -20, to: 0, materialWallMesh: boxMesh(materials.roomAWall, 'wall-corridor-a'), doorCenter: -10, prefix: 'wall-corridor-a' });
wallWithDoor({ axis: 'x', fixedCoord: 2, from: 0, to: 20, materialWallMesh: boxMesh(materials.roomBWall, 'wall-corridor-b'), doorCenter: 10, prefix: 'wall-corridor-b' });
wallWithDoor({ axis: 'x', fixedCoord: -2, from: -20, to: 0, materialWallMesh: boxMesh(materials.roomCWall, 'wall-corridor-c'), doorCenter: -10, prefix: 'wall-corridor-c' });
wallWithDoor({ axis: 'x', fixedCoord: -2, from: 0, to: 20, materialWallMesh: boxMesh(materials.roomDWall, 'wall-corridor-d'), doorCenter: 10, prefix: 'wall-corridor-d' });
// Refends A/B et C/D (pas de porte : on passe par le couloir).
plainWall({ axis: 'z', fixedCoord: 0, from: 2, to: 15, materialWallMesh: boxMesh(materials.roomBWall, 'wall-split-ab'), name: 'wall-split-ab' });
plainWall({ axis: 'z', fixedCoord: 0, from: -15, to: -2, materialWallMesh: boxMesh(materials.roomDWall, 'wall-split-cd'), name: 'wall-split-cd' });
// Murs pignons du couloir (déjà couverts par wall-west/wall-east) — rien à ajouter.

hingedDoor('door-1', -10, 2, -1);
hingedDoor('door-2', 10, 2, 1);
hingedDoor('door-3', -10, -2, -1);
hingedDoor('door-4', 10, -2, 1);

// --- Ventilateur de plafond, au centre du couloir (rotor en croix centré sur le pivot). ---
const fanHub = builder.addNode({ name: 'fan-hub', mesh: boxMesh(materials.fan, 'fan-hub'), translation: [0, -0.2, 0], scale: [0.3, 0.15, 0.3] });
const fanBladeX = builder.addNode({ name: 'fan-blade-x', mesh: boxMesh(materials.fan, 'fan-blade'), translation: [0, -0.15, 0], scale: [1.6, 0.05, 0.16] });
const fanBladeZ = builder.addNode({ name: 'fan-blade-z', mesh: boxMesh(materials.fan, 'fan-blade'), translation: [0, -0.15, 0], scale: [0.16, 0.05, 1.6] });
roots.push(builder.addNode({ name: 'fan', translation: [0, WALL_HEIGHT, 0], children: [fanHub, fanBladeX, fanBladeZ] }));

// --- Panneau coulissant, à l'intérieur de la pièce A (refend x=0, z≈8). Le pivot glisse ; le vantail reste centré sur lui. ---
const panelLeaf = builder.addNode({ name: 'panel-leaf', mesh: boxMesh(materials.panel, 'panel-leaf'), translation: [0, 0, 0], scale: [1.4, 2, 0.08] });
roots.push(builder.addNode({ name: 'panel', translation: [-0.05, 0, 8], children: [panelLeaf] }));

// --- Lampe baladeuse, suspendue dans le couloir. Le pivot voyage ; le corps reste centré sur lui. ---
const lampBody = builder.addNode({ name: 'lamp-mobile-body', mesh: boxMesh(materials.lampMobile, 'lamp-mobile-body'), translation: [0, -0.3, 0], scale: [0.3, 0.3, 0.3] });
roots.push(builder.addNode({ name: 'lamp-mobile', translation: [-6, 2.4, 0], children: [lampBody] }));

// --- Miroir fixe, mur est de la pièce B, métal lisse. ---
const mirrorFixedPlate = builder.addNode({ name: 'mirror-fixed-plate', mesh: boxMesh(materials.mirror, 'mirror-fixed'), translation: [0, 0.9, -0.03], scale: [1.2, 1.8, 0.05] });
roots.push(builder.addNode({ name: 'mirror-fixed', translation: [19.9, 0, 8], rotation: quatFromAxisAngle([0, 1, 0], -Math.PI / 2), children: [mirrorFixedPlate] }));

// --- Miroir pivotant, pièce C. ---
const mirrorTurningPlate = builder.addNode({ name: 'mirror-turning-plate', mesh: boxMesh(materials.mirror, 'mirror-turning'), translation: [0, 0.9, 0], scale: [1.1, 1.7, 0.05] });
roots.push(builder.addNode({ name: 'mirror-turning', translation: [-10, 0, -8], children: [mirrorTurningPlate] }));

// --- Sphère brillante sur un piédestal, pièce D (contre le mur rouge). ---
const spherePedestal = builder.addNode({ name: 'sphere-pedestal', mesh: boxMesh(materials.pedestal, 'sphere-pedestal'), translation: [0, 0, 0], scale: [0.6, 0.9, 0.6] });
const sphereBall = builder.addNode({ name: 'sphere-ball', mesh: sphereMesh(materials.sphere, 'sphere-ball'), translation: [0, 1.25, 0], scale: [0.7, 0.7, 0.7] });
roots.push(builder.addNode({ name: 'sphere', translation: [10, 0, -8], children: [spherePedestal, sphereBall] }));

// --- Fente fine dans le mur sud (x≈6) avec une petite pièce derrière. ---
plainBox('slit-frame', boxMesh(materials.slitFrame, 'slit-frame'), [6, 0, -15], [0.2, WALL_HEIGHT, 0.2]);
roots.push(builder.addNode({ name: 'slit', translation: [6, 1.5, -15] }));
plainWall({ axis: 'x', fixedCoord: -17, from: 5, to: 7, materialWallMesh: boxMesh(materials.hiddenRoom, 'hidden-room-back'), name: 'hidden-room-back' });
plainWall({ axis: 'z', fixedCoord: 5, from: -17, to: -15, materialWallMesh: boxMesh(materials.hiddenRoom, 'hidden-room-side-a'), name: 'hidden-room-side-a' });
plainWall({ axis: 'z', fixedCoord: 7, from: -17, to: -15, materialWallMesh: boxMesh(materials.hiddenRoom, 'hidden-room-side-b'), name: 'hidden-room-side-b' });

// --- Deux objets identiques dans deux pièces différentes (même maillage, nœuds distincts). ---
const twinMesh = boxMesh(materials.twin, 'twin');
roots.push(builder.addNode({ name: 'twin-a', mesh: twinMesh, translation: [-16, 0, 8], scale: [0.8, 0.8, 0.8] }));
roots.push(builder.addNode({ name: 'twin-b', mesh: twinMesh, translation: [16, 0, -8], scale: [0.8, 0.8, 0.8] }));

const glb = builder.build(roots);
await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, glb);
await writeFile(NAVIGATION_FILE, JSON.stringify({ boxes: navigationBoxes }));
console.log(`Maison de test écrite : ${OUT_FILE} (${(glb.length / 1024).toFixed(1)} Ko, ${builder.triangleCount} triangles de maillages uniques, ${navigationBoxes.length} boîtes de collision)`);
