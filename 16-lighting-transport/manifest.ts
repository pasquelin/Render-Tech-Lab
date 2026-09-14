import { defineLabManifest } from '../shared/contracts/manifest.ts';
import { scenarios } from './scenarios/index.ts';

export const manifest = defineLabManifest({
  contractVersion: 1,
  id: '16-lighting-transport',
  number: '16',
  title: 'Lumière',
  description: 'Trois sources colorées mobiles : comparer le parcours des obstacles à éclairage et résolution identiques.',
  capabilities: ['webgl2'],
  scenarios,
  status: 'experimental',
  publicEntry: '16-lighting-transport/index.ts',
});
