import { manifest as module00 } from '../../00-baseline/manifest.ts';
import { manifest as module01 } from '../../01-indirect-draw/manifest.ts';
import { manifest as module02 } from '../../02-gpu-frustum-culling/manifest.ts';
import { manifest as module03 } from '../../03-gpu-scene/manifest.ts';
import { manifest as module04 } from '../../04-gpu-lod/manifest.ts';
import { manifest as module05 } from '../../05-meshlets/manifest.ts';
import { manifest as module06 } from '../../06-meshlet-culling/manifest.ts';
import { manifest as module07 } from '../../07-hiz/manifest.ts';
import { manifest as module08 } from '../../08-occlusion-culling/manifest.ts';
import { manifest as module09 } from '../../09-gpu-compaction/manifest.ts';
import { manifest as module10 } from '../../10-material-batching/manifest.ts';
import { manifest as module11 } from '../../11-geometry-streaming/manifest.ts';
import { manifest as module12 } from '../../12-visibility-buffer/manifest.ts';
import { manifest as module13 } from '../../13-full-gpu-driven/manifest.ts';
import { manifest as module14 } from '../../14-open-world/manifest.ts';
import { manifest as module15 } from '../../15-virtualized-integration/manifest.ts';
import { manifest as module16 } from '../../16-lighting-transport/manifest.ts';
import type { LabManifest } from '../../shared/contracts/index.ts';

export const LAB_MANIFESTS: readonly LabManifest[] = [
  module00, module01, module02, module03, module04, module05, module06, module07, module08, module09, module10, module11, module12, module13, module14, module15, module16
];
