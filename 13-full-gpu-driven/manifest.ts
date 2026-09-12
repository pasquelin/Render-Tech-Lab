import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '13-full-gpu-driven', number: '13', title: 'Full Gpu Driven', description: "Full Gpu Driven : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['cpu-oracle'], scenarios, status: 'blocked', publicEntry: '13-full-gpu-driven/index.ts' });
