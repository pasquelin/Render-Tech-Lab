import * as THREE from 'three';
import type { MeshInstanceDef } from '../types.ts';

export const FLOATS_PER_INSTANCE = 24; // 16 (mat4) + 4 (sphere) + 4 (color)
export const BYTES_PER_INSTANCE = FLOATS_PER_INSTANCE * 4; // 96 octets

export class GpuSceneBuffer {
  public readonly count: number;
  public readonly instanceData: Float32Array;
  public readonly indirectData: Uint32Array;
  public readonly indexCount: number;

  constructor(instances: MeshInstanceDef[], baseGeometry: THREE.BufferGeometry) {
    this.count = instances.length;
    this.indexCount = baseGeometry.index
      ? baseGeometry.index.count
      : baseGeometry.attributes.position.count;

    this.instanceData = new Float32Array(this.count * FLOATS_PER_INSTANCE);

    for (let i = 0; i < this.count; i++) {
      const inst = instances[i];
      const offset = i * FLOATS_PER_INSTANCE;

      // 1. Matrice monde (16 floats, colonnes)
      inst.matrix.toArray(this.instanceData, offset);

      // 2. Sphère englobante espace monde (4 floats: center.x, center.y, center.z, radius)
      this.instanceData[offset + 16] = inst.boundingSphere.center.x;
      this.instanceData[offset + 17] = inst.boundingSphere.center.y;
      this.instanceData[offset + 18] = inst.boundingSphere.center.z;
      this.instanceData[offset + 19] = inst.boundingSphere.radius;

      // 3. Couleur d'instance (4 floats: r, g, b, 1.0)
      this.instanceData[offset + 20] = inst.color.r;
      this.instanceData[offset + 21] = inst.color.g;
      this.instanceData[offset + 22] = inst.color.b;
      this.instanceData[offset + 23] = 1.0;
    }

    // 5 entiers non-signés pour DrawIndexedIndirectArgs
    // [indexCount, instanceCount, firstIndex, baseVertex, firstInstance]
    this.indirectData = new Uint32Array(5);
    this.indirectData[0] = this.indexCount;
    this.indirectData[1] = 0; // Réinitialisé à chaque frame avant la passe compute
    this.indirectData[2] = 0;
    this.indirectData[3] = 0;
    this.indirectData[4] = 0;
  }
}
