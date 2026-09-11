import * as THREE from 'three';
import { GPUSceneBuffers } from './gpuSceneBuffers.ts';
import { CULLING_WGSL } from './gpuSceneCullingShader.ts';
import type { GeneratedGPUScene } from '../benchmark/stressScenarios.ts';

const RENDER_WGSL = /* wgsl */ `
struct CameraUniforms {
  viewProj: mat4x4<f32>,
  frustumPlanes: array<vec4<f32>, 6>,
};

struct GPUObject {
  transform: mat4x4<f32>,
  boundingCenterRadius: vec4<f32>,
  geometryId: u32,
  materialId: u32,
  flags: u32,
  padding: u32,
};

struct GPUMaterial {
  color: vec4<f32>, // rgb, roughness
  parameters: vec4<f32>, // metalness, flags, unused, unused
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<storage, read> objects: array<GPUObject>;
@group(0) @binding(2) var<storage, read> materials: array<GPUMaterial>;
@group(0) @binding(3) var<storage, read> visibleIndices: array<u32>;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) worldNormal: vec3<f32>,
  @location(1) color: vec3<f32>,
  @location(2) roughness: f32,
};

@vertex
fn vs_main(
  in: VertexInput,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  var out: VertexOutput;

  // L'instance index correspond au slot compacté dans visibleIndices
  let objectIdx = visibleIndices[instanceIndex];
  let obj = objects[objectIdx];
  let mat = materials[obj.materialId];

  let worldPos = obj.transform * vec4<f32>(in.position, 1.0);
  out.clipPosition = camera.viewProj * worldPos;

  // Transformation de normale
  let normalMatrix = mat3x3<f32>(
    obj.transform[0].xyz,
    obj.transform[1].xyz,
    obj.transform[2].xyz
  );
  out.worldNormal = normalize(normalMatrix * in.normal);
  out.color = mat.color.rgb;
  out.roughness = mat.color.w;

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.6));
  let nDotL = max(dot(in.worldNormal, lightDir), 0.0);

  let ambient = in.color * 0.25;
  let diffuse = in.color * nDotL * 0.85;

  let finalColor = ambient + diffuse;
  return vec4<f32>(finalColor, 1.0);
}
`;

export class GPUSceneRenderer {
  private device: GPUDevice;
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;

  public buffers: GPUSceneBuffers;
  private cullingPipeline!: GPUComputePipeline;
  private renderPipeline!: GPURenderPipeline;
  private depthTexture!: GPUTexture;

  private megaVertexBuffer!: GPUBuffer;
  private megaIndexBuffer!: GPUBuffer;

  private cullingBindGroup!: GPUBindGroup;
  private renderBindGroup!: GPUBindGroup;

  public sceneData: GeneratedGPUScene | null = null;

  constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.device = device;
    this.canvas = canvas;
    this.context = canvas.getContext('webgpu') as GPUCanvasContext;
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque',
    });

    this.buffers = new GPUSceneBuffers(device);
    this.initPipelines();
    this.initDepth();
  }

  private initPipelines() {
    // 1. Pipeline Compute pour le Culling & Indirect generation
    const cullingModule = this.device.createShaderModule({
      label: 'GPUScene.CullingWGSL',
      code: CULLING_WGSL,
    });

    this.cullingPipeline = this.device.createComputePipeline({
      label: 'GPUScene.CullingPipeline',
      layout: 'auto',
      compute: {
        module: cullingModule,
        entryPoint: 'main',
      },
    });

    // 2. Pipeline Render pour le tir indirect
    const renderModule = this.device.createShaderModule({
      label: 'GPUScene.RenderWGSL',
      code: RENDER_WGSL,
    });

    this.renderPipeline = this.device.createRenderPipeline({
      label: 'GPUScene.RenderPipeline',
      layout: 'auto',
      vertex: {
        module: renderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 24, // 6 floats x 4 bytes (pos: 3, norm: 3)
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' },
            ],
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
  }

  private initDepth() {
    if (this.depthTexture) this.depthTexture.destroy();
    this.depthTexture = this.device.createTexture({
      size: [Math.max(1, this.canvas.width), Math.max(1, this.canvas.height)],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  public setScene(sceneData: GeneratedGPUScene) {
    this.sceneData = sceneData;

    // Allocation et upload des buffers de scène hétérogènes
    this.buffers.allocate(sceneData.objects, sceneData.geometries, sceneData.materials);

    // Méga vertex buffer (positions + normales entrelacées)
    this.megaVertexBuffer = this.device.createBuffer({
      label: 'GPUScene.MegaVertexBuffer',
      size: sceneData.mergedVertexBuffer.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.megaVertexBuffer, 0, sceneData.mergedVertexBuffer.buffer as unknown as BufferSource);

    // Méga index buffer
    this.megaIndexBuffer = this.device.createBuffer({
      label: 'GPUScene.MegaIndexBuffer',
      size: sceneData.mergedIndexBuffer.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.megaIndexBuffer, 0, sceneData.mergedIndexBuffer.buffer as unknown as BufferSource);

    // Création des BindGroups
    this.cullingBindGroup = this.device.createBindGroup({
      layout: this.cullingPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.buffers.cameraBuffer! } },
        { binding: 1, resource: { buffer: this.buffers.objectBuffer! } },
        { binding: 2, resource: { buffer: this.buffers.geometryBuffer! } },
        { binding: 3, resource: { buffer: this.buffers.drawBuffer! } },
        { binding: 4, resource: { buffer: this.buffers.visibleIndicesBuffer! } },
        { binding: 5, resource: { buffer: this.buffers.countersBuffer! } },
      ],
    });

    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.buffers.cameraBuffer! } },
        { binding: 1, resource: { buffer: this.buffers.objectBuffer! } },
        { binding: 2, resource: { buffer: this.buffers.materialBuffer! } },
        { binding: 3, resource: { buffer: this.buffers.visibleIndicesBuffer! } },
      ],
    });
  }

  public updateCamera(camera: THREE.PerspectiveCamera) {
    if (!this.buffers.cameraBuffer) return;

    camera.updateMatrixWorld();
    const projMat = camera.projectionMatrix;
    const viewMat = camera.matrixWorldInverse;
    const viewProj = new THREE.Matrix4().multiplyMatrices(projMat, viewMat);

    // Calcul des 6 plans de frustum
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(viewProj);

    const buffer = new Float32Array(64); // 256 octets
    viewProj.toArray(buffer, 0);

    for (let i = 0; i < 6; i++) {
      const p = frustum.planes[i];
      const offset = 16 + i * 4;
      buffer[offset + 0] = p.normal.x;
      buffer[offset + 1] = p.normal.y;
      buffer[offset + 2] = p.normal.z;
      buffer[offset + 3] = p.constant;
    }

    this.device.queue.writeBuffer(this.buffers.cameraBuffer, 0, buffer.buffer as unknown as BufferSource);
  }

  public updateDynamicObjects(time: number, dynamicRatio: number) {
    if (!this.sceneData || !this.buffers.objectBuffer) return;

    const dynamicCount = Math.floor(this.sceneData.objects.length * dynamicRatio);
    if (dynamicCount === 0) return;

    const arrayBuffer = new ArrayBuffer(dynamicCount * 96);
    const floatView = new Float32Array(arrayBuffer);
    const tempMatrix = new THREE.Matrix4();
    const tempEuler = new THREE.Euler();
    const tempQuat = new THREE.Quaternion();
    const tempPos = new THREE.Vector3();
    const tempScale = new THREE.Vector3();

    for (let i = 0; i < dynamicCount; i++) {
      const obj = this.sceneData.objects[i];
      tempMatrix.fromArray(obj.transform);
      tempMatrix.decompose(tempPos, tempQuat, tempScale);

      tempEuler.setFromQuaternion(tempQuat);
      tempEuler.y += 0.02;
      tempEuler.x += 0.01;
      tempPos.y += Math.sin(time * 0.003 + i) * 0.05;
      tempQuat.setFromEuler(tempEuler);

      tempMatrix.compose(tempPos, tempQuat, tempScale);
      tempMatrix.toArray(obj.transform);

      const offsetFloat = i * 24;
      floatView.set(obj.transform, offsetFloat);
      floatView[offsetFloat + 16] = obj.boundingCenterRadius[0];
      floatView[offsetFloat + 17] = obj.boundingCenterRadius[1];
      floatView[offsetFloat + 18] = obj.boundingCenterRadius[2];
      floatView[offsetFloat + 19] = obj.boundingCenterRadius[3];

      const uintView = new Uint32Array(arrayBuffer);
      uintView[offsetFloat + 20] = obj.geometryId;
      uintView[offsetFloat + 21] = obj.materialId;
      uintView[offsetFloat + 22] = obj.flags;
      uintView[offsetFloat + 23] = 0;
    }

    this.device.queue.writeBuffer(this.buffers.objectBuffer, 0, arrayBuffer as unknown as BufferSource);
  }

  public render(): { submitMs: number; drawCalls: number } {
    if (!this.sceneData || !this.megaVertexBuffer || !this.megaIndexBuffer) {
      return { submitMs: 0, drawCalls: 0 };
    }

    const t0 = performance.now();

    // 1. Réinitialisation des compteurs et instanceCounts
    this.buffers.resetCounters();

    const commandEncoder = this.device.createCommandEncoder({
      label: 'GPUScene.CommandEncoder',
    });

    // 2. Passe Compute : Visibilité + Génération des commandes indirectes
    const computePass = commandEncoder.beginComputePass({
      label: 'GPUScene.ComputePass',
    });
    computePass.setPipeline(this.cullingPipeline);
    computePass.setBindGroup(0, this.cullingBindGroup);
    const workgroups = Math.ceil(this.sceneData.objects.length / 64);
    computePass.dispatchWorkgroups(workgroups);
    computePass.end();

    // 3. Passe Render : Tir des commandes indirectes
    const textureView = this.context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
      label: 'GPUScene.RenderPass',
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.11, g: 0.13, b: 0.17, a: 1.0 },
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
    renderPass.setVertexBuffer(0, this.megaVertexBuffer);
    renderPass.setIndexBuffer(this.megaIndexBuffer, 'uint32');

    // Tir des commandes indirectes par géométrie (1 commande par topologie distincte)
    const totalGeoms = this.buffers.totalGeometries;
    for (let g = 0; g < totalGeoms; g++) {
      renderPass.drawIndexedIndirect(this.buffers.drawBuffer!, g * 20);
    }

    renderPass.end();

    // 4. Soumission
    const commandBuffer = commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);

    const submitMs = performance.now() - t0;
    return {
      submitMs,
      drawCalls: totalGeoms,
    };
  }

  public resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.initDepth();
  }
}
