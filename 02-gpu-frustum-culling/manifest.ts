import { scenarios } from './scenarios/index.ts';
import { defineLabManifest } from '../shared/contracts/manifest.ts';
export const manifest = defineLabManifest({ contractVersion: 1, id: '02-gpu-frustum-culling', number: '02', title: 'GPU Frustum Culling', description: "GPU Frustum Culling : protocole expérimental et résultats conservés dans ce banc.", capabilities: ['webgpu'], scenarios, status: 'experimental', publicEntry: '02-gpu-frustum-culling/index.ts' });
