import { LOCAL_SCAN_SCATTER } from '../../shared/gpu/localScan.ts';
/**
 * Shaders WGSL pour le Culling Frustum GPU et l'écriture des commandes DrawIndexedIndirect
 */

export const RESET_COMPUTE_WGSL = /* wgsl */ `
struct IndirectDrawArgs {
    indexCount : u32,
    instanceCount : atomic<u32>,
    firstIndex : u32,
    baseVertex : i32,
    firstInstance : u32,
};

@group(0) @binding(0) var<storage, read_write> indirectArgs : IndirectDrawArgs;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    atomicStore(&indirectArgs.instanceCount, 0u);
}
`;

export type CullingVariant = 'atomic' | 'workgroup';
export function createCullingShader(variant: CullingVariant): string {
  const shared = variant === 'workgroup'
    ? 'var<workgroup> prefix: array<u32, 128>; var<workgroup> blockBase: u32;' : '';
  const scatter = variant === 'atomic' ? `    if (visible) {
      let slot = atomicAdd(&indirectArgs.instanceCount, 1u);
      visibleIndices[slot] = instanceId;
    }
` : `
    let flag = select(0u, 1u, visible);
${LOCAL_SCAN_SCATTER}`;
  return /* wgsl */ `struct CameraUniforms {
    viewProj : mat4x4<f32>,
    camPos : vec4<f32>,
    totalInstances : u32,
    _pad0 : u32,
    _pad1 : u32,
    _pad2 : u32,
    planes : array<vec4<f32>, 6>,
};

struct InstanceData {
    world0 : vec4<f32>,
    world1 : vec4<f32>,
    world2 : vec4<f32>,
    world3 : vec4<f32>,
    sphere : vec4<f32>, // xyz: center, w: radius
    color : vec4<f32>,
};

struct IndirectDrawArgs {
    indexCount : u32,
    instanceCount : atomic<u32>,
    firstIndex : u32,
    baseVertex : i32,
    firstInstance : u32,
};

@group(0) @binding(0) var<uniform> camera : CameraUniforms;
@group(0) @binding(1) var<storage, read> instances : array<InstanceData>;
@group(0) @binding(2) var<storage, read_write> indirectArgs : IndirectDrawArgs;
@group(0) @binding(3) var<storage, read_write> visibleIndices : array<u32>;


${shared}
@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) id: vec3<u32>,
        @builtin(local_invocation_index) lane: u32) {
    let instanceId = id.x;
    var visible = false;
    if (instanceId < camera.totalInstances) {
      let sphere = instances[instanceId].sphere;
      visible = true;
      for (var p = 0u; p < 6u; p++) {
        let plane = camera.planes[p];
        if (dot(plane.xyz, sphere.xyz) + plane.w < -sphere.w) { visible = false; }
      }
    }

${scatter}
}
`;
}
export const CULL_COMPUTE_WGSL = createCullingShader('atomic');
export const WORKGROUP_CULL_COMPUTE_WGSL = createCullingShader('workgroup');

export const RENDER_RASTER_WGSL = /* wgsl */ `
struct CameraUniforms {
    viewProj : mat4x4<f32>,
    camPos : vec4<f32>,
    totalInstances : u32,
    _pad0 : u32,
    _pad1 : u32,
    _pad2 : u32,
    planes : array<vec4<f32>, 6>,
};

struct InstanceData {
    world0 : vec4<f32>,
    world1 : vec4<f32>,
    world2 : vec4<f32>,
    world3 : vec4<f32>,
    sphere : vec4<f32>,
    color : vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera : CameraUniforms;
@group(0) @binding(1) var<storage, read> instances : array<InstanceData>;
@group(0) @binding(3) var<storage, read> visibleIndices : array<u32>;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @builtin(instance_index) instanceIdx : u32,
};

struct VertexOutput {
    @builtin(position) clipPos : vec4<f32>,
    @location(0) worldNormal : vec3<f32>,
    @location(1) color : vec4<f32>,
    @location(2) worldPos : vec3<f32>,
};

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
    var out : VertexOutput;
    
    // Dé-référencement de l'instance via le buffer compacté
    let originalId = visibleIndices[in.instanceIdx];
    let inst = instances[originalId];

    let worldMat = mat4x4<f32>(inst.world0, inst.world1, inst.world2, inst.world3);
    let worldPos4 = worldMat * vec4<f32>(in.position, 1.0);
    
    out.worldPos = worldPos4.xyz;
    out.clipPos = camera.viewProj * worldPos4;
    
    // Matrice normale approximative pour mise à l'échelle uniforme
    out.worldNormal = normalize((worldMat * vec4<f32>(in.normal, 0.0)).xyz);
    out.color = inst.color;
    
    return out;
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.4));
    let ambient = 0.2;
    let diff = max(dot(in.worldNormal, lightDir), 0.0) * 0.8;
    let finalColor = in.color.rgb * (ambient + diff);
    return vec4<f32>(finalColor, 1.0);
}
`;
