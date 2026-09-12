import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '03-gpu-scene', number: '03', title: 'Gpu Scene', description: "Gpu Scene : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['webgpu'], scenarios, status: 'experimental', publicEntry: '03-gpu-scene/index.ts' });
