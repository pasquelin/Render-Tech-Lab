import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '12-visibility-buffer', number: '12', title: 'Visibility Buffer', description: "Visibility Buffer : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['cpu-oracle'], scenarios, status: 'experimental', publicEntry: '12-visibility-buffer/index.ts' });
