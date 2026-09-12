import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '05-meshlets', number: '05', title: 'Meshlets', description: "Meshlets : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['cpu-oracle'], scenarios, status: 'experimental', publicEntry: '05-meshlets/index.ts' });
