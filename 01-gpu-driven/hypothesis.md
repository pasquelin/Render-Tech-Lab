# R&D Protocol: 01-gpu-driven (GPU-Driven Architecture)

> **Governing rule:** the engine only grows more complex once a reproducible measurement proves that the current architecture is genuinely limiting the product.

---

## 1. Hypothesis
- **Problem observed:** In standard Three.js, rendering scenes with a high count of unique objects (scenario S3: $\ge 2\,000$ objects) saturates the main thread with CPU submission (`submitMs`). CPU culling requires walking the scene graph, testing the frustum object by object, and encoding thousands of draw calls one at a time — a bottleneck that hits long before the GPU saturates.
- **Technical hypothesis:** Moving frustum culling and draw-command generation into a WebGPU compute shader that writes a `drawIndexedIndirect` buffer, while keeping the scene flattened into a GPU `StorageBuffer` with no CPU read-back (zero round-trip), will reduce `submitMs` to a constant $O(1)$ and unlock the frame rate.
- **Trigger threshold (crossover):** The GPU-driven architecture is justified if the crossover point lands at $\le 2\,000$ unique objects, with at least a 50% CPU frametime gain on scenario S3 ($2\,000$ objects), and no unacceptable GPU frametime regression ($\le +0.5\,\text{ms}$ for the compute pass).
- **Expected gain (quantified KPI):**
  - `CPU submitMs` down by $> 70\%$ at 2 000 objects.
  - Frame rate held at a steady 60 FPS on dense scenes.
  - A single CPU draw call instead of $N$ draw calls.

---

## 2. Prototype
- **Bench description:**
  - The same procedural scene generating $N$ unique meshes spread through a 3D volume, with an orbital / oscillating camera path.
  - A head-to-head between **Test A** (classic Three.js on `WebGPURenderer`) and **Test B** (GPU-driven mini-renderer using `IndirectStorageBufferAttribute` and a compute pass).
- **Isolation boundary:** Both tests share exactly the same geometries, PBR materials and camera projection matrices.
- **Source files:**
  - `01-gpu-driven/baseline/` (Test A)
  - `01-gpu-driven/implementation/` (Test B)
  - `01-gpu-driven/benchmark/` (runner & metrics)

---

## 3. Benchmark
- **Test scenarios:** Load tiers at 500, 1 000, 2 000 and 5 000 objects.
- **Target hardware:** macOS (Metal through WebGPU), Chrome/Edge with WebGPU enabled.
- **Metrics recorded:**
  - `CPU frame time` (`ms`)
  - `CPU submitMs` (`ms`)
  - `GPU frame time` through timestamp queries (`ms`)
  - CPU draw-call count
  - GPU compute dispatches
  - VRAM usage (`MB`)

---

## 4. Profiling
- **Tools used:** Performance Timeline / User Timing API, Chrome Tracing (`chrome://tracing`), Metal System Trace / WebGPU timestamp queries.
- **Bottleneck observations:** Analysis of the CPU submission load curve against the fixed cost of the compute dispatch.
- **Thermal behaviour & stability:** No memory leaks, and stable allocation of the indirect buffers.

---

## 5. Gain
- **Raw results:**
  - 500-object tier: baseline `... ms` vs GPU-driven `... ms` (delta: `... %`)
  - 1 000-object tier: baseline `... ms` vs GPU-driven `... ms` (delta: `... %`)
  - 2 000-object tier: baseline `... ms` vs GPU-driven `... ms` (delta: `... %`)
  - 5 000-object tier: baseline `... ms` vs GPU-driven `... ms` (delta: `... %`)
- **Observed crossover point:** `... objects`
- **Hypothesis confirmed:** [ ] Validated / [ ] Invalidated

---

## 6. Cost
- **Code complexity:** Explicit management of the scene storage buffers, plus maintenance of the WGSL/TSL culling compute shaders.
- **Memory / bandwidth overhead:** Extra VRAM for the indirect command buffer and the instance record buffer.
- **Integration cost:** Weighing Level A (direct TSL) against Level B (Three.js common backend) and Level C (experimental fork).

---

## 7. Decision
- **Verdict:** [ ] Merge into the main engine / [ ] Keep on the watchlist / [ ] Drop
- **Rationale:** 
- **Next steps:** (Phase 3 — add GPU screen-space LOD selection.)
