import { buildMeshlets } from '../../05-meshlets/index.ts';
import { projectedErrorBound } from '../../shared/math/geometry.ts';
import type { TriangleMesh } from '../../shared/fixtures/types.ts';

export const PAGE_BYTES = 12 * 16;
export interface Region { id: number; x: number; y: number; height: number; rootPage: number; finePage: number; error: number }
export interface ClusterAsset { regions: Region[]; pages: Uint8Array[]; source: Float32Array; certificate: string }
function page(vertices: number[][], indices: number[]): Uint8Array {
  const words = new Float32Array(PAGE_BYTES / 4);
  for (let v = 0; v < 12; v++) words.set([...vertices[indices[v] ?? indices[0]], 1], v * 4);
  return new Uint8Array(words.buffer);
}
/** Exact dyadic tent patches: coarse and fine share the same square boundary. */
export function buildClusterAsset(side = 8, height = 1 / 32): ClusterAsset {
  if (!Number.isInteger(side) || side < 1 || side > 16 || ![0, 1 / 32, 1 / 16].includes(height)) throw new Error('Uncertified fixture domain');
  const regions: Region[] = [], pages: Uint8Array[] = [], finePages: Uint8Array[] = [];
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const id = regions.length, cx = x - (side - 1) / 2, cy = y - (side - 1) / 2;
    const vertices = [[cx - .5, cy - .5, 0], [cx + .5, cy - .5, 0], [cx + .5, cy + .5, 0], [cx - .5, cy + .5, 0], [cx, cy, height]];
    const fine = [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4], coarse = [0, 1, 2, 0, 2, 3];
    const mesh: TriangleMesh = { name: `patch-${id}`, positions: new Float32Array(vertices.flat()), indices: new Uint32Array(fine), vertexCount: 5, triangleCount: 4 };
    const clusters = buildMeshlets(mesh, 64);
    if (clusters.meshlets.length !== 1 || clusters.meshlets[0].triangleCount !== 4) throw new Error('Cluster coverage mismatch');
    regions.push({ id, x: cx, y: cy, height, error: height, rootPage: id, finePage: side * side + id });
    pages.push(page(vertices, coarse)); finePages.push(page(vertices, fine));
  }
  pages.push(...finePages);
  const source = new Float32Array(regions.length * PAGE_BYTES / 4);
  finePages.forEach((p, i) => source.set(new Float32Array(p.buffer, p.byteOffset, p.byteLength / 4), i * 48));
  return { regions, pages, source,
    certificate: 'Analytic dyadic tent fixture only: same XY domain and shared boundary; vertical correspondence in both directions has distance <= height. Each region replaces all four tent faces collectively with two flat faces. No general mesh simplification certificate.' };
}
export function regionErrorPx(region: Region, eyeZ: number, focal: number): number {
  return projectedErrorBound(region.error, [region.x - .5, region.y - .5, eyeZ - region.height],
    [region.x + .5, region.y + .5, eyeZ], [focal, focal], .1) * 1.00001;
}
export function selectRegion(region: Region, eyeZ: number, focal: number, threshold: number, residentFine: boolean) {
  const errorPx = regionErrorPx(region, eyeZ, focal), wantsFine = errorPx > threshold;
  return { page: wantsFine && residentFine ? region.finePage : region.rootPage,
    wantsFine, fallback: wantsFine && !residentFine, errorPx: wantsFine && residentFine ? 0 : errorPx };
}
