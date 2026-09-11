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

export const CULL_COMPUTE_WGSL = /* wgsl */ `
struct CameraUniforms {
    viewProj : mat4x4<f32>,
    camPos : vec4<f32>,
    totalInstances : u32,
    _pad0 : u32,
    _pad1 : u32,
    _pad2 : u32,
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

// Extraction d'un plan à partir des lignes de la matrice ViewProjection
fn extractPlane(rowA : vec4<f32>, rowB : vec4<f32>, sign : f32) -> vec4<f32> {
    let p = rowA + sign * rowB;
    let len = length(p.xyz);
    if (len > 0.0) {
        return p / len;
    }
    return p;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let instanceId = global_id.x;
    if (instanceId >= camera.totalInstances) {
        return;
    }

    let inst = instances[instanceId];
    let center = inst.sphere.xyz;
    let radius = inst.sphere.w;

    // Lignes de la matrice ViewProj (Three.js WebGPU clip space Z: [0, 1])
    let row0 = vec4<f32>(camera.viewProj[0][0], camera.viewProj[1][0], camera.viewProj[2][0], camera.viewProj[3][0]);
    let row1 = vec4<f32>(camera.viewProj[0][1], camera.viewProj[1][1], camera.viewProj[2][1], camera.viewProj[3][1]);
    let row2 = vec4<f32>(camera.viewProj[0][2], camera.viewProj[1][2], camera.viewProj[2][2], camera.viewProj[3][2]);
    let row3 = vec4<f32>(camera.viewProj[0][3], camera.viewProj[1][3], camera.viewProj[2][3], camera.viewProj[3][3]);

    // 6 plans du Frustum
    var planes : array<vec4<f32>, 6>;
    planes[0] = extractPlane(row3, row0, 1.0);  // Gauche
    planes[1] = extractPlane(row3, row0, -1.0); // Droite
    planes[2] = extractPlane(row3, row1, 1.0);  // Bas
    planes[3] = extractPlane(row3, row1, -1.0); // Haut
    planes[4] = extractPlane(row2, vec4<f32>(0.0), 0.0); // Proche (Near WebGPU [0, 1]: row2 >= 0)
    planes[5] = extractPlane(row3, row2, -1.0); // Lointain (Far: row3 - row2 >= 0)

    var isVisible = true;
    for (var i = 0; i < 6; i++) {
        let dist = dot(planes[i].xyz, center) + planes[i].w;
        if (dist < -radius) {
            isVisible = false;
            break;
        }
    }

    if (isVisible) {
        let slot = atomicAdd(&indirectArgs.instanceCount, 1u);
        visibleIndices[slot] = instanceId;
    }
}
`;

export const RENDER_RASTER_WGSL = /* wgsl */ `
struct CameraUniforms {
    viewProj : mat4x4<f32>,
    camPos : vec4<f32>,
    totalInstances : u32,
    _pad0 : u32,
    _pad1 : u32,
    _pad2 : u32,
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
