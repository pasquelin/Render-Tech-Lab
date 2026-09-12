import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '10-material-batching', number: '10', title: 'Material Batching', description: "Material Batching : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['cpu-oracle'], scenarios, status: 'experimental', publicEntry: '10-material-batching/index.ts' });
