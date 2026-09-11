import * as THREE from 'three';
import type { MeshInstanceDef, FrameMeasurement } from '../types.ts';
import { GpuSceneBuffer } from './gpuSceneBuffer.ts';
import { RESET_COMPUTE_WGSL, CULL_COMPUTE_WGSL, RENDER_RASTER_WGSL } from './cullShader.ts';

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
  public totalTriangles: number = 0;

  constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    instances: MeshInstanceDef[],
    baseGeometry: THREE.BufferGeometry
  ) {
    this.device = device;
    this.context = context;
    this.format = format;
    this.instances = instances;
    this.baseGeometry = baseGeometry;

    this.sceneBuffer = new GpuSceneBuffer(instances, baseGeometry);
    this.indexCount = this.sceneBuffer.indexCount;
    this.totalTriangles = (this.indexCount / 3) * instances.length;

    this.initBuffers();
    this.initPipelines();
  }

  private initBuffers() {
    const d = this.device;

    // 1. Instance Data Buffer (Storage Buffer)
    this.instanceBuffer = d.createBuffer({
      label: 'GPU-Driven Instance Storage',
      size: this.sceneBuffer.instanceData.byteLength,
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
      size: this.instances.length * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // 4. Uniform Camera (mat4x4 viewProj + vec4 camPos + totalInstances + pad)
    // 16 floats (mat4) + 4 floats (camPos) + 4 floats (meta) = 24 floats * 4 = 96 octets (aligné 16 = 96)
    this.cameraUniformBuffer = d.createBuffer({
      label: 'GPU-Driven Camera Uniforms',
      size: 96,
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
  }

  private initPipelines() {
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
    const cullModule = d.createShaderModule({ code: CULL_COMPUTE_WGSL });
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
    frameIndex: number
  ): FrameMeasurement {
    const tStartCpu = performance.now();

    // 1. Mise à jour de l'Uniform Camera (CPU -> Uniform Buffer)
    const viewProj = new THREE.Matrix4();
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    const uniformArray = new Float32Array(24);
    viewProj.toArray(uniformArray, 0);
    uniformArray[16] = camera.position.x;
    uniformArray[17] = camera.position.y;
    uniformArray[18] = camera.position.z;
    uniformArray[19] = 1.0;
    // Métadonnées
    new Uint32Array(uniformArray.buffer, 20 * 4, 1)[0] = this.instances.length;

    this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, uniformArray as unknown as BufferSource);

    // 2. Mesure isolée de la soumission GPU-driven
    // (encodage du compute reset + compute cull + 1 unique drawIndexedIndirect)
    const tStartSubmit = performance.now();

    const commandEncoder = this.device.createCommandEncoder({
      label: 'GPU-Driven Frame Encoder',
    });

    // A. Étape Compute : Reset atomique du compteur de visibilité
    const computePass = commandEncoder.beginComputePass({
      label: 'Culling & Compaction Pass',
    });
    computePass.setPipeline(this.resetPipeline);
    computePass.setBindGroup(0, this.resetBindGroup);
    computePass.dispatchWorkgroups(1);

    // B. Étape Compute : Frustum Culling sur l'ensemble des 2 000 instances
    computePass.setPipeline(this.cullPipeline);
    computePass.setBindGroup(0, this.computeBindGroup);
    const workgroups = Math.ceil(this.instances.length / 64);
    computePass.dispatchWorkgroups(workgroups);
    computePass.end();

    // C. Étape Raster : DrawIndexedIndirect
    const currentTexture = this.context.getCurrentTexture();
    const renderPass = commandEncoder.beginRenderPass({
      label: 'Indirect Raster Pass',
      colorAttachments: [
        {
          view: currentTexture.createView(),
          clearValue: { r: 0.04, g: 0.05, b: 0.07, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setVertexBuffer(1, this.normalBuffer);
    renderPass.setIndexBuffer(this.indexBuffer, 'uint32');

    // EXÉCUTION INDIRECTE : 1 SEUL APPEL, ZÉRO RETOUR CPU
    renderPass.drawIndexedIndirect(this.indirectBuffer, 0);

    renderPass.end();

    // Soumission de la commande complète vers la queue WebGPU
    this.device.queue.submit([commandEncoder.finish()]);

    const tEndSubmit = performance.now();
    const tEndCpu = performance.now();

    const submitMs = tEndSubmit - tStartSubmit;
    const cpuFrameMs = tEndCpu - tStartCpu;

    return {
      frameIndex,
      cpuFrameMs,
      submitMs,
      fps: cpuFrameMs > 0 ? 1000 / cpuFrameMs : 60,
      drawCalls: 1, // 1 seul draw call indirect au lieu de 2 000 !
      triangles: this.totalTriangles,
    };
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
