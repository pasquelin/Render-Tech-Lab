import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '00-baseline', number: '00', title: 'Baseline', description: "Baseline : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['cpu-oracle'], scenarios, status: 'experimental', publicEntry: '00-baseline/index.ts' });
