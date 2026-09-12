import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '15-virtualized-integration', number: '15', title: 'Virtualized Integration', description: "Virtualized Integration : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['webgpu'], scenarios, status: 'experimental', publicEntry: '15-virtualized-integration/index.ts' });
