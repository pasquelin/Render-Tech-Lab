import type { TimestampBatch } from '../../shared/gpu/timing.ts';
import * as THREE from 'three';
import type { MeshInstanceDef, FrameMeasurement } from '../types.ts';
import { GpuSceneBuffer } from './gpuSceneBuffer.ts';
import { RESET_COMPUTE_WGSL, createCullingShader, RENDER_RASTER_WGSL, type CullingVariant } from './cullShader.ts';

export class GpuDrivenRenderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;
  private instances: MeshInstanceDef[];
  private baseGeometry: THREE.BufferGeometry;

  // Buffers WebGPU
  private instanceBuffer!: GPUBuffer;
  private indirectBuffer!: GPUBuffer;
  private visibleIndicesBuffer!: GPUBuffer;
  private cameraUniformBuffer!: GPUBuffer;
  private vertexBuffer!: GPUBuffer;
  private normalBuffer!: GPUBuffer;
  private indexBuffer!: GPUBuffer;
  private depthTexture!: GPUTexture;

  // Pipelines WebGPU
  private resetPipeline!: GPUComputePipeline;
  private cullPipeline!: GPUComputePipeline;
  private renderPipeline!: GPURenderPipeline;

  // BindGroups
  private computeBindGroup!: GPUBindGroup;
  private resetBindGroup!: GPUBindGroup;
  private renderBindGroup!: GPUBindGroup;

  private sceneBuffer: GpuSceneBuffer;
  private indexCount: number;
  private readonly drawMode: 'direct' | 'indirect';
  private readonly directIds: Uint32Array;
  private readonly directCount = new Uint32Array(1);
  private readonly viewProj = new THREE.Matrix4();
  private readonly frustum = new THREE.Frustum();
  private readonly uniformArray = new Float32Array(48);
  private readonly uniformU32 = new Uint32Array(this.uniformArray.buffer);
  private readonly computeDescriptor: GPUComputePassDescriptor = { label: 'Reset & Culling' };
  private renderDescriptor!: GPURenderPassDescriptor;
  private colorAttachment!: GPURenderPassColorAttachment;
  private readonly submitList: GPUCommandBuffer[] = [];
  private readonly measurement: FrameMeasurement = { frameIndex: 0, cpuFrameMs: 0,
    submitMs: 0, fps: null, drawCalls: 1, triangles: 0 };
  public totalTriangles: number = 0;

  constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    instances: MeshInstanceDef[],
    baseGeometry: THREE.BufferGeometry,
    variant: CullingVariant = 'atomic',
    drawMode: 'direct' | 'indirect' = 'indirect'
  ) {
    this.drawMode = drawMode;
    this.directIds = new Uint32Array(instances.length);
    this.device = device;
    this.context = context;
    this.format = format;
    this.instances = instances;
    this.baseGeometry = baseGeometry;

    this.sceneBuffer = new GpuSceneBuffer(instances, baseGeometry);
    this.indexCount = this.sceneBuffer.indexCount;
    this.totalTriangles = (this.indexCount / 3) * instances.length;

    this.initBuffers();
    this.initPipelines(variant);
  }

  private initBuffers() {
    const d = this.device;

    // 1. Instance Data Buffer (Storage Buffer)
    this.instanceBuffer = d.createBuffer({
      label: 'GPU-Driven Instance Storage',
      size: Math.max(96, this.sceneBuffer.instanceData.byteLength),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    d.queue.writeBuffer(this.instanceBuffer, 0, this.sceneBuffer.instanceData as unknown as BufferSource);

    // 2. Indirect Buffer (STORAGE pour le compute + INDIRECT pour le raster)
    // 5 entiers u32 = 20 octets
    this.indirectBuffer = d.createBuffer({
      label: 'GPU-Driven DrawIndexedIndirectBuffer',
      size: 20,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    d.queue.writeBuffer(this.indirectBuffer, 0, this.sceneBuffer.indirectData as unknown as BufferSource);

    // 3. Buffer d'indices visibles compactés
    this.visibleIndicesBuffer = d.createBuffer({
      label: 'GPU-Driven Visible Indices',
      size: Math.max(4, this.instances.length * 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    // 4. Uniform Camera (mat4x4 viewProj + vec4 camPos + totalInstances + pad)
    // 16 floats (mat4) + 4 floats (camPos) + 4 floats (meta) = 24 floats * 4 = 96 octets (aligné 16 = 96)
    this.cameraUniformBuffer = d.createBuffer({
      label: 'GPU-Driven Camera Uniforms',
      size: 192,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 5. Extraction géométrie Three.js -> Buffers GPU
    const posAttr = this.baseGeometry.attributes.position;
    this.vertexBuffer = d.createBuffer({
      label: 'Geometry Positions',
      size: posAttr.array.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    d.queue.writeBuffer(this.vertexBuffer, 0, posAttr.array as unknown as BufferSource);

    const normAttr = this.baseGeometry.attributes.normal;
    this.normalBuffer = d.createBuffer({
      label: 'Geometry Normals',
      size: normAttr.array.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    d.queue.writeBuffer(this.normalBuffer, 0, normAttr.array as unknown as BufferSource);

    if (this.baseGeometry.index) {
      const idxArr = this.baseGeometry.index.array;
      const typedArr = idxArr instanceof Uint32Array ? idxArr : new Uint32Array(idxArr);
      this.indexBuffer = d.createBuffer({
        label: 'Geometry Indices',
        size: typedArr.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      d.queue.writeBuffer(this.indexBuffer, 0, typedArr as unknown as BufferSource);
    }

    this.createDepthTexture();
  }

  public createDepthTexture() {
    const canvas = this.context.canvas as HTMLCanvasElement;
    if (this.depthTexture) this.depthTexture.destroy();
    this.depthTexture = this.device.createTexture({
      size: [Math.max(1, canvas.width), Math.max(1, canvas.height)],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.colorAttachment = { view: this.depthTexture.createView(), clearValue: { r: 0.04, g: 0.05, b: 0.07, a: 1 }, loadOp: 'clear', storeOp: 'store' };
    this.renderDescriptor = { label: 'Indirect Raster', colorAttachments: [this.colorAttachment],
      depthStencilAttachment: { view: this.depthTexture.createView(), depthClearValue: 1,
        depthLoadOp: 'clear', depthStoreOp: 'store' } };
  }

  private initPipelines(variant: CullingVariant) {
    const d = this.device;

    // --- Reset Pipeline ---
    const resetModule = d.createShaderModule({ code: RESET_COMPUTE_WGSL });
    this.resetPipeline = d.createComputePipeline({
      label: 'Indirect Reset Pipeline',
      layout: 'auto',
      compute: { module: resetModule, entryPoint: 'main' },
    });

    this.resetBindGroup = d.createBindGroup({
      layout: this.resetPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.indirectBuffer } }],
    });

    // --- Cull Frustum Pipeline ---
    const cullModule = d.createShaderModule({ code: createCullingShader(variant) });
    this.cullPipeline = d.createComputePipeline({
      label: 'Frustum Cull Compute Pipeline',
      layout: 'auto',
      compute: { module: cullModule, entryPoint: 'main' },
    });

    this.computeBindGroup = d.createBindGroup({
      layout: this.cullPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cameraUniformBuffer } },
        { binding: 1, resource: { buffer: this.instanceBuffer } },
        { binding: 2, resource: { buffer: this.indirectBuffer } },
        { binding: 3, resource: { buffer: this.visibleIndicesBuffer } },
      ],
    });

    // --- Raster Pipeline ---
    const renderModule = d.createShaderModule({ code: RENDER_RASTER_WGSL });
    this.renderPipeline = d.createRenderPipeline({
      label: 'GPU-Driven Raster Pipeline',
      layout: 'auto',
      vertex: {
        module: renderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 12,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
          },
          {
            arrayStride: 12,
            attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }],
          },
        ],
      },
      fragment: {
        module: renderModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });

    this.renderBindGroup = d.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cameraUniformBuffer } },
        { binding: 1, resource: { buffer: this.instanceBuffer } },
        { binding: 3, resource: { buffer: this.visibleIndicesBuffer } },
      ],
    });
  }

  public renderFrame(
    camera: THREE.PerspectiveCamera,
    frameIndex: number, timer?: TimestampBatch, sample = 0
  ): FrameMeasurement {
    const tStartCpu = performance.now();

    // 1. Mise à jour de l'Uniform Camera (CPU -> Uniform Buffer)
    const viewProj = this.viewProj;
    if (camera.coordinateSystem !== THREE.WebGPUCoordinateSystem) {
      camera.coordinateSystem = THREE.WebGPUCoordinateSystem;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    const uniformArray = this.uniformArray;
    viewProj.toArray(uniformArray, 0);
    uniformArray[16] = camera.position.x;
    uniformArray[17] = camera.position.y;
    uniformArray[18] = camera.position.z;
    uniformArray[19] = 1.0;
    // Métadonnées
    this.uniformU32[20] = this.instances.length;
    this.frustum.setFromProjectionMatrix(viewProj, THREE.WebGPUCoordinateSystem);
    for (let i = 0; i < 6; i++) {
      const plane = this.frustum.planes[i], offset = 24 + 4 * i;
      uniformArray[offset] = plane.normal.x; uniformArray[offset + 1] = plane.normal.y;
      uniformArray[offset + 2] = plane.normal.z; uniformArray[offset + 3] = plane.constant;
    }

    this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, uniformArray as unknown as BufferSource);

    let directVisible = 0;
    if (this.drawMode === 'direct') {
      for (let i = 0; i < this.instances.length; i++) {
        const offset = i * 24 + 16, data = this.sceneBuffer.instanceData;
        let visible = true;
        for (let p = 0; p < 6; p++) {
          const o = 24 + p * 4;
          if (uniformArray[o] * data[offset] + uniformArray[o + 1] * data[offset + 1]
            + uniformArray[o + 2] * data[offset + 2] + uniformArray[o + 3] < -data[offset + 3]) visible = false;
        }
        if (visible) this.directIds[directVisible++] = i;
      }
      this.directCount[0] = directVisible;
      this.device.queue.writeBuffer(this.indirectBuffer, 4, this.directCount);
      if (directVisible) this.device.queue.writeBuffer(this.visibleIndicesBuffer, 0, this.directIds.buffer as ArrayBuffer, 0, directVisible * 4);
    }

    // 2. Mesure isolée de la soumission GPU-driven
    // (encodage du compute reset + compute cull + 1 unique drawIndexedIndirect)
    const tStartSubmit = performance.now();

    const commandEncoder = this.device.createCommandEncoder({
      label: 'GPU-Driven Frame Encoder',
    });

    // A. Étape Compute : Reset atomique du compteur de visibilité
    this.computeDescriptor.timestampWrites = timer?.writes(sample, 0);
    const computePass = commandEncoder.beginComputePass(this.computeDescriptor);
    if (this.drawMode === 'indirect') {
    computePass.setPipeline(this.resetPipeline);
    computePass.setBindGroup(0, this.resetBindGroup);
    computePass.dispatchWorkgroups(1);

    // B. Étape Compute : Frustum Culling sur l'ensemble des 2 000 instances
    computePass.setPipeline(this.cullPipeline);
    computePass.setBindGroup(0, this.computeBindGroup);
    const workgroups = Math.ceil(this.instances.length / 128);
    if (workgroups > 0) computePass.dispatchWorkgroups(workgroups);
    }
    computePass.end();

    // C. Étape Raster : DrawIndexedIndirect
    this.colorAttachment.view = this.context.getCurrentTexture().createView();
    this.renderDescriptor.timestampWrites = timer?.writes(sample, 1);
    const renderPass = commandEncoder.beginRenderPass(this.renderDescriptor);

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setVertexBuffer(1, this.normalBuffer);
    renderPass.setIndexBuffer(this.indexBuffer, 'uint32');

    // EXÉCUTION INDIRECTE : 1 SEUL APPEL, ZÉRO RETOUR CPU
    if (this.drawMode === 'indirect') renderPass.drawIndexedIndirect(this.indirectBuffer, 0);
    else for (let i = 0; i < directVisible; i++) renderPass.drawIndexed(this.indexCount, 1, 0, 0, i);

    renderPass.end();

    // Soumission de la commande complète vers la queue WebGPU
    if (timer && sample === timer.capacity - 1) timer.resolve(commandEncoder);
    this.submitList[0] = commandEncoder.finish();
    this.device.queue.submit(this.submitList);
    if (timer && sample === timer.capacity - 1) timer.submitted();

    const tEndSubmit = performance.now();
    const tEndCpu = performance.now();

    const submitMs = tEndSubmit - tStartSubmit;
    const cpuFrameMs = tEndCpu - tStartCpu;

    const m = this.measurement;
    m.frameIndex = frameIndex; m.cpuFrameMs = cpuFrameMs; m.submitMs = submitMs;
    m.triangles = this.totalTriangles; m.fps = null;
    m.drawCalls = this.drawMode === 'indirect' ? 1 : directVisible;
    return m;
  }

  public async readVisibleIds(): Promise<Uint32Array> {
    const bytes = 4 + this.instances.length * 4;
    const read = this.device.createBuffer({ size: Math.max(8, bytes), usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    try {
      const encoder = this.device.createCommandEncoder();
      encoder.copyBufferToBuffer(this.indirectBuffer, 4, read, 0, 4);
      if (this.instances.length) encoder.copyBufferToBuffer(this.visibleIndicesBuffer, 0, read, 4, this.instances.length * 4);
      this.device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      const words = new Uint32Array(read.getMappedRange());
      const count = words[0];
      if (count > this.instances.length) throw new Error('Visible count overflow');
      return words.slice(1, count + 1);
    } finally { if (read.mapState === 'mapped') read.unmap(); read.destroy(); }
  }

  public dispose() {
    this.instanceBuffer.destroy();
    this.indirectBuffer.destroy();
    this.visibleIndicesBuffer.destroy();
    this.cameraUniformBuffer.destroy();
    this.vertexBuffer.destroy();
    this.normalBuffer.destroy();
    if (this.indexBuffer) this.indexBuffer.destroy();
    if (this.depthTexture) this.depthTexture.destroy();
  }
}
