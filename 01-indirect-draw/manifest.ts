import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '01-indirect-draw', number: '01', title: 'Indirect Draw', description: "Indirect Draw : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['webgpu'], scenarios, status: 'experimental', publicEntry: '01-indirect-draw/index.ts' });
