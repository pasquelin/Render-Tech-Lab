import type { GPUObjectData, GPUGeometryData, GPUMaterialData } from '../contracts.ts';

/**
 * Layout WGSL d'un GPUObject : 16 floats transform + 4 floats bounding sphere
 * + 4 u32 metadata = 24 slots de 4 octets = 96 octets.
 * Source unique de vérité : toute écriture du buffer objet passe par packObject().
 */
export const SLOTS_PER_OBJECT = 24;
export const BYTES_PER_OBJECT = SLOTS_PER_OBJECT * 4;

/** Écrit un objet dans les vues partagées d'un même ArrayBuffer, au slot `index`. */
export function packObject(
  floatView: Float32Array,
  uintView: Uint32Array,
  index: number,
  obj: GPUObjectData
) {
  const o = index * SLOTS_PER_OBJECT;

  // Transform matrix (16 floats)
  floatView.set(obj.transform, o);

  // Bounding Sphere (4 floats : x, y, z, radius)
  floatView[o + 16] = obj.boundingCenterRadius[0];
  floatView[o + 17] = obj.boundingCenterRadius[1];
  floatView[o + 18] = obj.boundingCenterRadius[2];
  floatView[o + 19] = obj.boundingCenterRadius[3];

  // Metadata (4 u32 : geometryId, materialId, flags, padding)
  uintView[o + 20] = obj.geometryId;
  uintView[o + 21] = obj.materialId;
  uintView[o + 22] = obj.flags;
  uintView[o + 23] = 0;
}

export class GPUSceneBuffers {
  private device: GPUDevice;

  public objectBuffer: GPUBuffer | null = null;
  public geometryBuffer: GPUBuffer | null = null;
  public materialBuffer: GPUBuffer | null = null;
  public drawBuffer: GPUBuffer | null = null;
  public visibleIndicesBuffer: GPUBuffer | null = null;
  public cameraBuffer: GPUBuffer | null = null;
  public countersBuffer: GPUBuffer | null = null;

  public totalObjects: number = 0;
  public totalGeometries: number = 0;
  public totalMaterials: number = 0;

  private initialDrawArray: Uint32Array | null = null;
  private zeroCounters = new Uint32Array([0, 0, 0, 0]);
  private counterStaging: GPUBuffer | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Détruit la génération de tampons courante.
   * `allocate()` est rappelé à chaque scénario : sans cela une campagne de 12
   * scénarios laisse 84 GPUBuffer orphelins en VRAM.
   */
  public dispose() {
    for (const b of [
      this.objectBuffer,
      this.geometryBuffer,
      this.materialBuffer,
      this.drawBuffer,
      this.visibleIndicesBuffer,
      this.cameraBuffer,
      this.countersBuffer,
    ]) {
      b?.destroy();
    }
    this.objectBuffer = null;
    this.geometryBuffer = null;
    this.materialBuffer = null;
    this.drawBuffer = null;
    this.visibleIndicesBuffer = null;
    this.cameraBuffer = null;
    this.countersBuffer = null;
  }

  public allocate(
    objects: GPUObjectData[],
    geometries: GPUGeometryData[],
    materials: GPUMaterialData[]
  ) {
    this.dispose();
    this.totalObjects = objects.length;
    this.totalGeometries = Math.max(1, geometries.length);
    this.totalMaterials = Math.max(1, materials.length);

    // 1. ObjectBuffer : 96 octets par objet (16 floats transform + 4 floats sphere + 4 u32 meta)
    // Alignement WGSL : 24 floats (96 bytes)
    const objBytes = Math.max(256, this.totalObjects * BYTES_PER_OBJECT);
    this.objectBuffer = this.device.createBuffer({
      label: 'GPUScene.ObjectBuffer',
      size: objBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // 2. GeometryBuffer : 32 octets par géométrie (8 x u32/f32) - alignement 16-octets WGSL
    const geomBytes = Math.max(256, this.totalGeometries * 32);
    this.geometryBuffer = this.device.createBuffer({
      label: 'GPUScene.GeometryBuffer',
      size: geomBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // 3. MaterialBuffer : 32 octets par matériau (2 x vec4)
    const matBytes = Math.max(256, this.totalMaterials * 32);
    this.materialBuffer = this.device.createBuffer({
      label: 'GPUScene.MaterialBuffer',
      size: matBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // 4. DrawBuffer (Indirect commands) : 20 octets par commande (5 x u32)
    // 1 commande par géométrie distincte
    const drawBytes = Math.max(256, this.totalGeometries * 20);
    this.drawBuffer = this.device.createBuffer({
      label: 'GPUScene.DrawBuffer',
      size: drawBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
    });

    // 5. Buffer d'indices visibles compactés
    const visBytes = Math.max(256, this.totalObjects * 4);
    this.visibleIndicesBuffer = this.device.createBuffer({
      label: 'GPUScene.VisibleIndices',
      size: visBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // 6. Camera Uniforms : ViewProj (64 octets) + 6 plans (6 x 16 = 96 octets) = 160 octets
    this.cameraBuffer = this.device.createBuffer({
      label: 'GPUScene.Camera',
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 7. Compteurs globaux (4 x u32 = 16 octets)
    this.countersBuffer = this.device.createBuffer({
      label: 'GPUScene.Counters',
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    // Initialisation des géométries et matériaux en VRAM
    this.uploadGeometries(geometries);
    this.uploadMaterials(materials);
    this.uploadObjects(objects);
  }

  public uploadObjects(objects: GPUObjectData[]) {
    if (!this.objectBuffer || objects.length === 0) return;
    const arrayBuffer = new ArrayBuffer(objects.length * BYTES_PER_OBJECT);
    const floatView = new Float32Array(arrayBuffer);
    const uintView = new Uint32Array(arrayBuffer);

    for (let i = 0; i < objects.length; i++) {
      packObject(floatView, uintView, i, objects[i]);
    }

    this.device.queue.writeBuffer(this.objectBuffer, 0, arrayBuffer as unknown as BufferSource);
  }

  public uploadGeometries(geometries: GPUGeometryData[]) {
    if (!this.geometryBuffer || !this.drawBuffer || geometries.length === 0) return;

    // 8 éléments u32/f32 par géométrie (32 octets, alignement 16-octets WGSL)
    const geomArray = new Uint32Array(geometries.length * 8);
    const floatGeom = new Float32Array(geomArray.buffer);
    const drawArray = new Uint32Array(geometries.length * 5);

    for (let i = 0; i < geometries.length; i++) {
      const g = geometries[i];
      const gOffset = i * 8;
      geomArray[gOffset + 0] = g.vertexOffset;
      geomArray[gOffset + 1] = g.indexOffset;
      geomArray[gOffset + 2] = g.indexCount;
      geomArray[gOffset + 3] = g.instanceOffset;
      floatGeom[gOffset + 4] = g.boundingRadius;
      geomArray[gOffset + 5] = 0; // pad0
      geomArray[gOffset + 6] = 0; // pad1
      geomArray[gOffset + 7] = 0; // pad2

      // Commande DrawIndexedIndirect :
      // [indexCount, instanceCount, firstIndex, baseVertex, firstInstance]
      const dOffset = i * 5;
      drawArray[dOffset + 0] = g.indexCount;
      drawArray[dOffset + 1] = 0; // instanceCount sera incrémenté atomiquement par le compute shader
      drawArray[dOffset + 2] = g.indexOffset;
      drawArray[dOffset + 3] = g.vertexOffset;
      drawArray[dOffset + 4] = g.instanceOffset; // firstInstance pour débuter le tir d'instances
    }

    this.initialDrawArray = new Uint32Array(drawArray);
    this.device.queue.writeBuffer(this.geometryBuffer, 0, geomArray as unknown as BufferSource);
    this.device.queue.writeBuffer(this.drawBuffer, 0, drawArray as unknown as BufferSource);
  }

  public uploadMaterials(materials: GPUMaterialData[]) {
    if (!this.materialBuffer || materials.length === 0) return;
    const array = new Float32Array(materials.length * 8);

    for (let i = 0; i < materials.length; i++) {
      const m = materials[i];
      const offset = i * 8;
      array[offset + 0] = m.color[0];
      array[offset + 1] = m.color[1];
      array[offset + 2] = m.color[2];
      array[offset + 3] = m.color[3];

      array[offset + 4] = m.parameters[0];
      array[offset + 5] = m.parameters[1];
      array[offset + 6] = m.parameters[2];
      array[offset + 7] = m.parameters[3];
    }

    this.device.queue.writeBuffer(this.materialBuffer, 0, array as unknown as BufferSource);
  }

  /** Total des octets VRAM détenus par les 7 tampons de scène. */
  public get totalBytes(): number {
    return [
      this.objectBuffer,
      this.geometryBuffer,
      this.materialBuffer,
      this.drawBuffer,
      this.visibleIndicesBuffer,
      this.cameraBuffer,
      this.countersBuffer,
    ].reduce((sum, b) => sum + (b ? b.size : 0), 0);
  }

  /**
   * Relit les compteurs atomiques remplis par la passe compute.
   * Les valeurs correspondent à la dernière frame soumise (ils sont remis à
   * zéro au début de chaque `render()`).
   */
  public async readCounters(): Promise<{ visible: number; culled: number } | null> {
    if (!this.countersBuffer) return null;

    if (!this.counterStaging) {
      this.counterStaging = this.device.createBuffer({
        label: 'GPUScene.CountersStaging',
        size: 16,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
    }

    const encoder = this.device.createCommandEncoder({ label: 'GPUScene.CounterReadback' });
    encoder.copyBufferToBuffer(this.countersBuffer, 0, this.counterStaging, 0, 16);
    this.device.queue.submit([encoder.finish()]);

    await this.counterStaging.mapAsync(GPUMapMode.READ);
    const view = new Uint32Array(this.counterStaging.getMappedRange().slice(0));
    this.counterStaging.unmap();

    return { visible: view[0], culled: view[1] };
  }

  public resetCounters() {
    if (!this.countersBuffer || !this.drawBuffer || !this.initialDrawArray) return;
    // Remise à zéro des compteurs atomiques globaux en 1 seul transfert
    this.device.queue.writeBuffer(this.countersBuffer, 0, this.zeroCounters as unknown as BufferSource);

    // Remise à zéro des instanceCount indirects en 1 seul transfert contigu
    this.device.queue.writeBuffer(this.drawBuffer, 0, this.initialDrawArray as unknown as BufferSource);
  }
}
