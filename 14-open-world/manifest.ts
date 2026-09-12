import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '14-open-world', number: '14', title: 'Open World', description: "Open World : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['webgl2'], scenarios, status: 'experimental', publicEntry: '14-open-world/index.ts' });
