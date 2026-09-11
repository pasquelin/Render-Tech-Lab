import type { BenchmarkStrategy } from '../shared/benchmark/comparison.ts';
import { LOCAL_SCAN_SCATTER } from '../shared/gpu/localScan.ts';
import { RESET_COMPUTE_WGSL } from '../01-indirect-draw/implementation/cullShader.ts';

export function createCompactionStrategies(device: GPUDevice, count: number,
  pattern: 'mixed' | 'all' | 'none' = 'mixed'): BenchmarkStrategy[] {
  const flags = Uint32Array.from({ length: Math.max(1, count) }, (_, i) =>
    i < count && (pattern === 'all' || (pattern === 'mixed' && i % 3 !== 0)) ? 1 : 0);
  const expected: number[] = [];
  for (let i = 0; i < count; i++) if (flags[i]) expected.push(i);
  const strategies: BenchmarkStrategy[] = [];
  for (const id of ['serial', 'atomic', 'workgroup'] as const) {
    const input = device.createBuffer({ size: flags.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const output = device.createBuffer({ size: flags.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const args = device.createBuffer({ size: 20, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const params = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(input, 0, flags);
    device.queue.writeBuffer(params, 0, new Uint32Array([count, 0, 0, 0]));
    const shader = /* wgsl */ `
struct Params { count: u32, pad0: u32, pad1: u32, pad2: u32 }
struct Args { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: i32, firstInstance: u32 }
@group(0) @binding(0) var<storage, read> flags: array<u32>;
@group(0) @binding(1) var<storage, read_write> visibleIndices: array<u32>;
@group(0) @binding(2) var<storage, read_write> indirectArgs: Args;
@group(0) @binding(3) var<uniform> params: Params;
${id === 'workgroup' ? 'var<workgroup> prefix: array<u32,128>; var<workgroup> blockBase: u32;' : ''}
@compute @workgroup_size(${id === 'serial' ? 1 : 128})
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_index) lane: u32) {
${id === 'serial' ? `
  var n = 0u;
  for (var i = 0u; i < params.count; i++) { if (flags[i] == 1u) { visibleIndices[n] = i; n++; } }
  atomicStore(&indirectArgs.instanceCount, n);
` : `
  let instanceId = gid.x;
  var flag = 0u;
  if (instanceId < params.count) { flag = flags[instanceId]; }
  ${id === 'atomic' ? 'if (flag == 1u) { let slot = atomicAdd(&indirectArgs.instanceCount, 1u); visibleIndices[slot] = instanceId; }' : LOCAL_SCAN_SCATTER}
`}
}`;
    const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module: device.createShaderModule({ code: shader }), entryPoint: 'main' } });
    const reset = device.createComputePipeline({ layout: 'auto', compute: { module: device.createShaderModule({ code: RESET_COMPUTE_WGSL }), entryPoint: 'main' } });
    const resetBind = device.createBindGroup({ layout: reset.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: args } }] });
    const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [input, output, args, params].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const first: GPUComputePassDescriptor = {}, second: GPUComputePassDescriptor = {};
    const submitted: GPUCommandBuffer[] = [];
    const render: BenchmarkStrategy['render'] = (_frame, timer, sample = 0) => {
      const encoder = device.createCommandEncoder();
      first.timestampWrites = timer?.writes(sample, 0);
      const resetPass = encoder.beginComputePass(first);
      resetPass.setPipeline(reset); resetPass.setBindGroup(0, resetBind); resetPass.dispatchWorkgroups(1); resetPass.end();
      second.timestampWrites = timer?.writes(sample, 1);
      const pass = encoder.beginComputePass(second);
      pass.setPipeline(pipeline); pass.setBindGroup(0, bind);
      if (count) pass.dispatchWorkgroups(id === 'serial' ? 1 : Math.ceil(count / 128));
      pass.end();
      if (timer && sample === timer.capacity - 1) timer.resolve(encoder);
      submitted[0] = encoder.finish(); device.queue.submit(submitted);
      if (timer && sample === timer.capacity - 1) timer.submitted();
    };
    strategies.push({ id, render, dispose: () => { input.destroy(); output.destroy(); args.destroy(); params.destroy(); },
      verify: async () => {
        render(0);
        const read = device.createBuffer({ size: 4 + flags.byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        try {
          const encoder = device.createCommandEncoder();
          encoder.copyBufferToBuffer(args, 4, read, 0, 4);
          encoder.copyBufferToBuffer(output, 0, read, 4, flags.byteLength);
          device.queue.submit([encoder.finish()]); await read.mapAsync(GPUMapMode.READ);
          const words = new Uint32Array(read.getMappedRange());
          if (words[0] !== expected.length) throw new Error(`${id}: invalid compacted count`);
          const actual = words.slice(1, 1 + words[0]);
          if (id !== 'serial') actual.sort();
          if (actual.some((v, i) => v !== expected[i])) throw new Error(`${id}: invalid compacted IDs`);
        } finally { if (read.mapState === 'mapped') read.unmap(); read.destroy(); }
      } });
  }
  return strategies;
}
