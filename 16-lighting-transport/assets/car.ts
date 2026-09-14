#!/usr/bin/env node
// Boîte de secours pour la voiture d'Emerald (le modèle n'a pas de véhicule, voir emeraldFixtures.ts).
// Compilée séparément du cache Emerald (lecture seule) : le banc l'affiche dans son propre aperçu,
// jamais composée sur la géométrie du Lab principal, pour ne dépendre d'aucune option de transparence
// non garantie par l'API publique.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGlbBuilder } from './glbBuilder.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT_FILE = resolve(HERE, 'source/car.glb');

const builder = createGlbBuilder();
const body = builder.addMaterial({ name: 'car-body', baseColorFactor: [0.75, 0.1, 0.12, 1], metallicFactor: 0.4, roughnessFactor: 0.35 });
const glass = builder.addMaterial({ name: 'car-glass', baseColorFactor: [0.1, 0.12, 0.15, 1], metallicFactor: 0.1, roughnessFactor: 0.15 });

const lowerBody = builder.addNode({ name: 'car-lower', mesh: builder.addMesh('box', body, 'car-lower'), translation: [0, 0, 0], scale: [1.8, 0.7, 4.2] });
const cabin = builder.addNode({ name: 'car-cabin', mesh: builder.addMesh('box', glass, 'car-cabin'), translation: [0, 0.7, -0.4], scale: [1.4, 0.55, 2.2] });
const root = builder.addNode({ name: 'car', translation: [0, 0, 0], children: [lowerBody, cabin] });

const glb = builder.build([root]);
await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, glb);
console.log(`Voiture (boîte) écrite : ${OUT_FILE} (${(glb.length / 1024).toFixed(1)} Ko, ${builder.triangleCount} triangles)`);
