import { defineLabManifest } from '../shared/contracts/manifest.ts';
import { scenarios } from './scenarios/index.ts';

export const manifest = defineLabManifest({
  contractVersion: 1,
  id: '16-lighting-transport',
  number: '16',
  title: 'Lumière',
  description: 'Banc de test du moteur WebGeometry : deux scènes (intérieure et urbaine nocturne), lampes réglables et transformations de nœuds animées en boucle, appelées via les API publiques prepare()/createExplorer().',
  capabilities: ['webgl2'],
  scenarios,
  status: 'experimental',
  publicEntry: '16-lighting-transport/index.ts',
});
