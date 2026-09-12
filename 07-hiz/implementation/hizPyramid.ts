/**
 * 07-hiz/implementation/hizPyramid.ts
 *
 * Implémentation de la pyramide de profondeur Hi-Z (Hierarchical-Z).
 * Réutilise l'oracle hizReduceCeil de shared/math/hiz.ts.
 */

import { hizReduceInto } from '../../shared/math/hiz.ts';
import type {
  HiZPyramid,
  HiZMip,
  HiZCost,
  HiZQueryResult,
} from '../contracts.ts';

export interface HiZPyramidData {
  pyramid: HiZPyramid;
  cost: HiZCost;
  mipBuffers: Float32Array[]; // Niveaux de profondeur CPU mips 0..depth-1
}

/**
 * Construit la pyramide Hi-Z complète à partir d'un tampon de profondeur initial.
 * Effectue un downsampling récursif 2x2 conservateur (Math.max pour depth standard).
 */
export function buildHiZPyramid(
  baseDepth: number[][],
  reversedZ: boolean = false,
  format: GPUTextureFormat = 'r32float'
): HiZPyramidData {
  const startTime = performance.now();
  const height = baseDepth.length;
  const width = height > 0 ? baseDepth[0].length : 0;

  if (width === 0 || height === 0) {
    throw new Error('Tampon de profondeur de base invalide');
  }

  const mips: HiZMip[] = [];
  const mipBuffers: Float32Array[] = [];
  const perMipMs: number[] = [];

  // Mip 0 : Pleine résolution
  mips.push({ level: 0, width, height, format });
  const flat = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    if (baseDepth[y].length !== width) throw new Error('Profondeur non rectangulaire');
    for (let x = 0; x < width; x++) {
      const value = baseDepth[y][x];
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Profondeur invalide');
      flat[y * width + x] = value;
    }
  }
  mipBuffers.push(flat);

  let currentBuffer = flat;
  let currentW = width, currentH = height;
  let currentLevel = 0;
  let totalBytes = width * height * 4; // 4 octets par texel en r32float

  while (currentW > 1 || currentH > 1) {
    const mipStartTime = performance.now();
    const mipW = Math.ceil(currentW / 2), mipH = Math.ceil(currentH / 2);
    const next = new Float32Array(mipW * mipH);
    hizReduceInto(currentBuffer, currentW, currentH, next, reversedZ);
    currentBuffer = next;
    currentW = mipW; currentH = mipH;
    const mipDuration = performance.now() - mipStartTime;

    currentLevel++;

    mips.push({ level: currentLevel, width: mipW, height: mipH, format });
    mipBuffers.push(currentBuffer);
    perMipMs.push(Number(mipDuration.toFixed(3)));
    totalBytes += mipW * mipH * 4;
  }

  const totalDuration = performance.now() - startTime;

  return {
    pyramid: {
      mips,
      depth: mips.length,
    },
    cost: {
      generationMs: Number(totalDuration.toFixed(3)),
      perMipMs,
      totalBytes,
    },
    mipBuffers,
  };
}

/**
 * Interroge la pyramide Hi-Z pour tester si une boîte 2D [x0, y0, x1, y1]
 * à une profondeur donnée `testDepth` est complètement occluse.
 */
export function queryHiZ(
  pyramidData: HiZPyramidData,
  box: { x0: number; y0: number; x1: number; y1: number },
  testDepth: number,
  reversedZ: boolean = false
): HiZQueryResult {
  if (!Number.isFinite(box.x0) || !Number.isFinite(box.y0) || !Number.isFinite(box.x1) || !Number.isFinite(box.y1) || !Number.isFinite(testDepth)) {
    throw new Error('Requête Hi-Z non finie');
  }
  if (box.x1 < box.x0 || box.y1 < box.y0 || testDepth < 0 || testDepth > 1) {
    throw new Error('Requête Hi-Z hors contrat');
  }
  const { mips } = pyramidData.pyramid;
  const boxW = Math.max(1, box.x1 - box.x0);
  const boxH = Math.max(1, box.y1 - box.y0);
  const maxDim = Math.max(boxW, boxH);

  // Choix du niveau de mip tel que l'empreinte de la boîte couvre ~1 à 2 texels
  let targetMip = Math.floor(Math.log2(Math.max(1, maxDim)));
  targetMip = Math.max(0, Math.min(mips.length - 1, targetMip));

  const mip = mips[targetMip];
  const buffer = pyramidData.mipBuffers[targetMip];

  // Conversion des coordonnées écran en coordonnées texels du mip
  const scaleX = 1 / (2 ** targetMip);
  const scaleY = scaleX;

  const tx0 = Math.max(0, Math.min(mip.width - 1, Math.floor(box.x0 * scaleX)));
  const ty0 = Math.max(0, Math.min(mip.height - 1, Math.floor(box.y0 * scaleY)));
  const tx1 = Math.max(0, Math.min(mip.width - 1, Math.floor(box.x1 * scaleX)));
  const ty1 = Math.max(0, Math.min(mip.height - 1, Math.floor(box.y1 * scaleY)));

  let maxDepthInFootprint = reversedZ ? 1.0 : 0.0;
  for (let y = ty0; y <= ty1; y++) {
    for (let x = tx0; x <= tx1; x++) {
      const d = buffer[y * mip.width + x];
      if (reversedZ) {
        if (d < maxDepthInFootprint) maxDepthInFootprint = d;
      } else {
        if (d > maxDepthInFootprint) maxDepthInFootprint = d;
      }
    }
  }

  // Occlus si la profondeur du candidat est plus lointaine que la profondeur conservatrice maximale du Hi-Z
  const occluded = reversedZ
    ? testDepth < maxDepthInFootprint - 1e-6
    : testDepth > maxDepthInFootprint + 1e-6;

  return {
    occluded,
    mipLevel: targetMip,
  };
}

/**
 * Shader Compute WGSL standardisé pour la réduction récursive Hi-Z 2x2.
 */
export const WGSL_HIZ_REDUCE = /* wgsl */ `
@group(0) @binding(0) var sourceDepth : texture_2d<f32>;
@group(0) @binding(1) var destDepth : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  if (any(id.xy >= textureDimensions(destDepth))) { return; }
  let dstCoord = vec2<i32>(id.xy);
  let srcCoord = dstCoord * 2;
  let dims = textureDimensions(sourceDepth);

  let c00 = srcCoord;
  let c10 = min(srcCoord + vec2<i32>(1, 0), vec2<i32>(dims) - vec2<i32>(1, 1));
  let c01 = min(srcCoord + vec2<i32>(0, 1), vec2<i32>(dims) - vec2<i32>(1, 1));
  let c11 = min(srcCoord + vec2<i32>(1, 1), vec2<i32>(dims) - vec2<i32>(1, 1));

  let d00 = textureLoad(sourceDepth, c00, 0).r;
  let d10 = textureLoad(sourceDepth, c10, 0).r;
  let d01 = textureLoad(sourceDepth, c01, 0).r;
  let d11 = textureLoad(sourceDepth, c11, 0).r;

  // Réduction conservatrice Max (pour standard Z où 1.0 = fond)
  let maxDepth = max(max(d00, d10), max(d01, d11));
  textureStore(destDepth, dstCoord, vec4<f32>(maxDepth, 0.0, 0.0, 0.0));
}
`;
