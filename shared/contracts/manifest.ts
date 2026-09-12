import type { LabManifest } from './index.ts';
export const defineLabManifest = <T extends LabManifest>(manifest: T): T => Object.freeze(manifest);
