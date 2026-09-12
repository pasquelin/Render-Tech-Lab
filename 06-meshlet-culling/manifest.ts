import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '06-meshlet-culling', number: '06', title: 'Meshlet Culling', description: "Meshlet Culling : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['cpu-oracle'], scenarios, status: 'experimental', publicEntry: '06-meshlet-culling/index.ts' });
