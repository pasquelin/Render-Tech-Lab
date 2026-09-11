import * as THREE from 'three';
import { GPUSceneBuffers, BYTES_PER_OBJECT, packObject } from './gpuSceneBuffers.ts';
import { configureCanvas } from '../../src/common/gpuContext.ts';
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

  private megaVertexBuffer: GPUBuffer | null = null;
  private megaIndexBuffer: GPUBuffer | null = null;

  private cullingBindGroup!: GPUBindGroup;
  private renderBindGroup!: GPUBindGroup;

  public sceneData: GeneratedGPUScene | null = null;

  // Vue de profondeur mise en cache : ne change qu'au resize, pas à chaque frame.
  private depthView!: GPUTextureView;

  // Scratch réutilisés par updateCamera() — évite 3 allocations par frame.
  private camScratch = new Float32Array(64); // 256 octets
  private camViewProj = new THREE.Matrix4();
  private camFrustum = new THREE.Frustum();

  // Scratch réutilisés par updateDynamicObjects() — dimensionnés dans setScene().
  private objScratch: ArrayBuffer = new ArrayBuffer(0);
  private objFloatView: Float32Array = new Float32Array(0);
  private objUintView: Uint32Array = new Uint32Array(0);
  private tempMatrix = new THREE.Matrix4();
  private tempEuler = new THREE.Euler();
  private tempQuat = new THREE.Quaternion();
  private tempPos = new THREE.Vector3();
  private tempScale = new THREE.Vector3();

  constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.device = device;
    this.canvas = canvas;
    // Passe par le helper partagé : c'est la dernière copie de la configuration
    // de contexte que src/common/gpuContext.ts a été créé pour centraliser.
    const { context, format } = configureCanvas(canvas, device);
    this.context = context;
    this.format = format;

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
    this.depthView = this.depthTexture.createView();
  }

  public setScene(sceneData: GeneratedGPUScene) {
    this.sceneData = sceneData;

    // Libération de la génération précédente : setScene() est rappelé à chaque
    // scénario de la matrice, sinon la VRAM des scènes passées s'accumule.
    this.megaVertexBuffer?.destroy();
    this.megaIndexBuffer?.destroy();

    // Allocation et upload des buffers de scène hétérogènes
    this.buffers.allocate(sceneData.objects, sceneData.geometries, sceneData.materials);

    // Redimensionnement du scratch d'upload des objets dynamiques (96 octets par objet)
    const scratchBytes = sceneData.objects.length * BYTES_PER_OBJECT;
    if (this.objScratch.byteLength < scratchBytes) {
      this.objScratch = new ArrayBuffer(scratchBytes);
      this.objFloatView = new Float32Array(this.objScratch);
      this.objUintView = new Uint32Array(this.objScratch);
    }

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
    const viewProj = this.camViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    // Calcul des 6 plans de frustum
    this.camFrustum.setFromProjectionMatrix(viewProj);

    const buffer = this.camScratch;
    viewProj.toArray(buffer, 0);

    for (let i = 0; i < 6; i++) {
      const p = this.camFrustum.planes[i];
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

    const { tempMatrix, tempEuler, tempQuat, tempPos, tempScale, objFloatView, objUintView } = this;

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
      // La transform CPU est relue à la frame suivante (fromArray ci-dessus),
      // donc elle doit rester à jour ; packObject la recopie ensuite dans le scratch.
      tempMatrix.toArray(obj.transform);
      packObject(objFloatView, objUintView, i, obj);
    }

    // Un seul transfert contigu, borné aux objets réellement mis à jour.
    this.device.queue.writeBuffer(
      this.buffers.objectBuffer,
      0,
      this.objScratch as unknown as BufferSource,
      0,
      dynamicCount * BYTES_PER_OBJECT
    );
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
        view: this.depthView,
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

  /** Compteurs réels de visibilité produits par la passe compute. */
  public readCullingCounters(): Promise<{ visible: number; culled: number } | null> {
    return this.buffers.readCounters();
  }

  /** Empreinte VRAM des tampons de scène (hors méga vertex/index). */
  public getSceneBufferBytes(): number {
    return (
      this.buffers.totalBytes +
      (this.megaVertexBuffer?.size ?? 0) +
      (this.megaIndexBuffer?.size ?? 0)
    );
  }

  public resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.initDepth();
  }
}
