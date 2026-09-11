// Shared workgroup scan; caller defines flag, lane, instanceId and storage bindings.
export const LOCAL_SCAN_SCATTER = /* wgsl */ `  prefix[lane] = flag;
  workgroupBarrier();

  // Blelloch upsweep: O(W) total additions, log2(W) synchronization stages.
  for (var stride = 1u; stride < 128u; stride = stride * 2u) {
    let right = (lane + 1u) * stride * 2u - 1u;
    if (right < 128u) { prefix[right] += prefix[right - stride]; }
    workgroupBarrier();
  }
  if (lane == 0u) {
    let total = prefix[127];
    blockBase = 0u;
    if (total > 0u) { blockBase = atomicAdd(&indirectArgs.instanceCount, total); }
    prefix[127] = 0u;
  }
  workgroupBarrier();

  // Downsweep yields a stable exclusive prefix within this workgroup.
  for (var stride = 64u; stride > 0u; stride = stride / 2u) {
    let right = (lane + 1u) * stride * 2u - 1u;
    if (right < 128u) {
      let leftValue = prefix[right - stride];
      prefix[right - stride] = prefix[right];
      prefix[right] += leftValue;
    }
    workgroupBarrier();
  }
  if (flag != 0u) { visibleIndices[blockBase + prefix[lane]] = instanceId; }
`;
