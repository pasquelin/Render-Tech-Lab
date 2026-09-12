import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '04-gpu-lod', number: '04', title: 'Gpu Lod', description: "Gpu Lod : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['webgpu'], scenarios, status: 'experimental', publicEntry: '04-gpu-lod/index.ts' });
