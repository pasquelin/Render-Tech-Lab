/** Stable local ranks preserve the CPU's ascending object-ID order within each LOD. */
export const NATIVE_LOD_LOCAL_RANK = /* wgsl */ `
struct Selection { lod:u32, pixels:f32, pad0:u32, pad1:u32 };
@group(0) @binding(0) var<storage,read> selections:array<Selection>;
@group(0) @binding(1) var<storage,read_write> localRanks:array<u32>;
@group(0) @binding(2) var<storage,read_write> groupCounts:array<u32>;
var<workgroup> groupLods:array<u32,64>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>,
        @builtin(local_invocation_id) lid:vec3<u32>, @builtin(workgroup_id) group:vec3<u32>) {
  var lod=3u;
  if(gid.x<arrayLength(&selections)){lod=selections[gid.x].lod;}
  groupLods[lid.x]=lod;
  workgroupBarrier();
  if(lid.x<3u){
    var count=0u;
    for(var slot=0u;slot<64u;slot++){if(groupLods[slot]==lid.x){count++;}}
    groupCounts[group.x*3u+lid.x]=count;
  }
  if(gid.x<arrayLength(&selections)){
    var rank=0u;
    for(var slot=0u;slot<lid.x;slot++){if(groupLods[slot]==lod){rank++;}}
    localRanks[gid.x]=rank;
  }
}
`;

/** Group prefixes plus local ranks produce deterministic compacted instance buffers. */
export const NATIVE_LOD_COMPACTION = /* wgsl */ `
struct Selection { lod:u32, pixels:f32, pad0:u32, pad1:u32 };
struct Draw { indices:u32, instances:atomic<u32>, firstIndex:u32, baseVertex:i32, firstInstance:u32 };
@group(0) @binding(0) var<storage,read> selections:array<Selection>;
@group(0) @binding(1) var<storage,read> localRanks:array<u32>;
@group(0) @binding(2) var<storage,read> groupCounts:array<u32>;
@group(0) @binding(3) var<storage,read_write> ids0:array<u32>;
@group(0) @binding(4) var<storage,read_write> ids1:array<u32>;
@group(0) @binding(5) var<storage,read_write> ids2:array<u32>;
@group(0) @binding(6) var<storage,read_write> draws:array<Draw>;
var<workgroup> groupBases:array<u32,3>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>,
        @builtin(local_invocation_id) lid:vec3<u32>, @builtin(workgroup_id) group:vec3<u32>) {
  if(lid.x==0u){
    var totals=array<u32,3>(0u,0u,0u);
    for(var previous=0u;previous<group.x;previous++){
      for(var lod=0u;lod<3u;lod++){totals[lod]+=groupCounts[previous*3u+lod];}
    }
    for(var lod=0u;lod<3u;lod++){groupBases[lod]=totals[lod];}
    if(group.x==0u){
      for(var next=0u;next<arrayLength(&groupCounts)/3u;next++){
        for(var lod=0u;lod<3u;lod++){totals[lod]+=groupCounts[next*3u+lod];}
      }
      for(var lod=0u;lod<3u;lod++){atomicStore(&draws[lod].instances,totals[lod]);}
    }
  }
  workgroupBarrier();
  let id=gid.x;
  if(id>=arrayLength(&selections)){return;}
  let lod=selections[id].lod;
  let slot=groupBases[lod]+localRanks[id];
  if(lod==0u){ids0[slot]=id;} else if(lod==1u){ids1[slot]=id;} else {ids2[slot]=id;}
}
`;

export const NATIVE_LOD_RASTER = /* wgsl */ `
struct Camera { viewProjection:mat4x4<f32> };
struct ObjectData {
  transform:mat4x4<f32>, bounds:vec4<f32>, metadata:vec4<u32>
};
@group(0) @binding(0) var<uniform> camera:Camera;
@group(0) @binding(1) var<storage,read> objects:array<ObjectData>;
@group(0) @binding(2) var<storage,read> ids:array<u32>;
struct VertexOut { @builtin(position) clip:vec4<f32>, @location(0) normal:vec3<f32> };
@vertex fn vs_main(@location(0) position:vec3<f32>, @location(1) normal:vec3<f32>,
  @builtin(instance_index) instance:u32)->VertexOut {
  let obj=objects[ids[instance]];
  var out:VertexOut;
  out.clip=camera.viewProjection*obj.transform*vec4<f32>(position,1.0);
  out.normal=normalize((obj.transform*vec4<f32>(normal,0.0)).xyz);
  return out;
}
@fragment fn fs_main(in:VertexOut)->@location(0) vec4<f32> {
  let diffuse=max(dot(normalize(in.normal),normalize(vec3<f32>(0.5,1.0,0.6))),0.0);
  let color=vec3<f32>(0.31,0.64,0.78)*(0.25+0.75*diffuse);
  return vec4<f32>(color,1.0);
}
`;
