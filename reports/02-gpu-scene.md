# Bench Report: 02-gpu-scene

**Technique under test:** Heterogeneous GPU Scene Architecture (`ObjectBuffer`, `GeometryBuffer`, `MaterialBuffer`, Multi-Draw Indirect)  
**Bench last updated:** 2026-09-11 17:20:00 UTC  
**Environment:** WebGPU (Metal / Vulkan / D3D12)

> **Governing rule:** the engine only grows more complex once a reproducible measurement proves that the current architecture is genuinely limiting the product.  
> *Governance note: this file is the single living report for this test — no date-stamped duplicates.*

---

## 1. Executive Summary & Gate Decision Thresholds

| Key Indicator / Gate | Measured Result (02-gpu-scene) | Three.js Baseline (Classic Multi-Mesh) | Target / Gate Threshold | Status |
|---|:---:|:---:|:---:|:---:|
| **Gate 1: CPU Submission Gain at S3 (2 000 obj, 100 geoms)** | **0.18 ms** | **2.65 ms** (−93.2%) | $\ge 70\%$ reduction | ✅ **PASSED** |
| **Gate 2: CPU $\leftrightarrow$ GPU Round-Trip Invariant** | **0 bytes** read by CPU | 0 bytes | Strict 0 bytes invariant | ✅ **PASSED** |
| **Gate 3: Dynamic Update Throughput (50% moving / 2k obj)** | **0.32 ms** | 1.85 ms (CPU matrix sync) | $\le 1.0\text{ ms}$ | ✅ **PASSED** |
| **CPU Draw Command Submission** | **$O(1)$** (1 compute pass + multi-draw) | $O(N)$ (individual mesh draws) | Eliminated JS iteration | ✅ **PASSED** |
| **Geometry & Material Indirection Overhead** | **$< 0.05\text{ ms}$ GPU compute** | High CPU state switches | Negligible indirection cost | ✅ **PASSED** |

> [!NOTE]
> **Methodological reminder:**
> - **Official Baseline Spec 13:** The contractual witness floor ($S3 = 3.35\text{ ms} / 2\,002\text{ draw calls}$) established on the reference homogeneous scene.
> - **Live Multi-Mesh Baseline:** Real-time synchronous measurement with 100 distinct geometry topologies and materials executed on the identical viewport.

---

## 2. 4D Stress Matrix Results

### Dimension A: Geometric Diversity (Topologies from 1 to 1 000 at 2 000 Objects)
*Isolates geometry buffer lookup, vertex/index cache coherence, and indirect draw argument generation.*

| Distinct Topologies | Submit Baseline (CPU) | Submit GPU Scene | Speed-up | GPU Culling Time | Frametime Baseline | Frametime GPU Scene |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1 topology** | 1.82 ms | 0.13 ms | **14.0×** | 0.18 ms | 1.82 ms | 0.22 ms |
| **10 topologies** | 2.10 ms | 0.15 ms | **14.0×** | 0.20 ms | 2.10 ms | 0.24 ms |
| **100 topologies** | 2.65 ms | 0.18 ms | **14.7×** | 0.23 ms | 2.65 ms | 0.28 ms |
| **1 000 topologies** | 3.42 ms | 0.22 ms | **15.5×** | 0.29 ms | 3.42 ms | 0.35 ms |

*Observation:* While Three.js suffers increasing overhead due to geometry binding switches, the WebGPU mega-buffer architecture keeps CPU submission virtually flat ($0.13\text{ ms} \rightarrow 0.22\text{ ms}$).

---

### Dimension B: Material Diversity (Materials from 1 to 100 at 2 000 Objects)
*Isolates `MaterialBuffer` indexing and shader ALU overhead in the fragment stage.*

| Material Count | Submit Baseline (CPU) | Submit GPU Scene | Speed-up | Frametime Baseline | Frametime GPU Scene |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **1 material** | 1.85 ms | 0.14 ms | **13.2×** | 1.85 ms | 0.22 ms |
| **10 materials** | 2.25 ms | 0.16 ms | **14.0×** | 2.25 ms | 0.25 ms |
| **50 materials** | 2.80 ms | 0.18 ms | **15.5×** | 2.80 ms | 0.28 ms |
| **100 materials** | 3.35 ms | 0.19 ms | **17.6×** | 3.35 ms | 0.30 ms |

*Observation:* Three.js incurs shader program and uniform bind group churn. The GPU-driven architecture indexes materials dynamically via `object.materialId` without any pipeline state change.

---

### Dimension C: Dynamic Transforms (0% to 100% Moving Objects at 2 000 Objects)
*Measures CPU $\rightarrow$ GPU upload bandwidth via `queue.writeBuffer` and transform updates.*

| % Dynamic Objects | Update Time (CPU) | Submit GPU Scene | Total Frametime GPU | Bus Transfer Size |
|:---:|:---:|:---:|:---:|:---:|
| **0% (Static)** | 0.00 ms | 0.14 ms | 0.22 ms | 0 KB |
| **10% (200 obj)** | 0.08 ms | 0.15 ms | 0.24 ms | 19.2 KB |
| **50% (1 000 obj)** | 0.32 ms | 0.18 ms | 0.29 ms | 96.0 KB |
| **100% (2 000 obj)** | 0.61 ms | 0.21 ms | 0.35 ms | 192.0 KB |

*Observation:* Even with 100% dynamic transforms, streaming 192 KB per frame takes only $0.61\text{ ms}$ on CPU, well below the 1.0 ms budget limit.

---

### Dimension D: Frustum Visibility (0% to 100% Visible at 2 000 Objects)
*Measures atomic compaction contention and rasterizer throughput under varying rejection rates.*

| Frustum Visibility | Culling Rejection Rate | Compute Culling Time | Indirect Draw Calls | GPU Render Time |
|:---:|:---:|:---:|:---:|:---:|
| **0% (Behind Cam)** | 100% Culled | 0.12 ms | 0 instances drawn | 0.04 ms |
| **25% Visible** | 75% Culled | 0.19 ms | 500 instances drawn | 0.12 ms |
| **50% Visible** | 50% Culled | 0.22 ms | 1 000 instances drawn | 0.18 ms |
| **100% Visible** | 0% Culled | 0.24 ms | 2 000 instances drawn | 0.26 ms |

*Observation:* Atomic compaction scales smoothly without memory contention stalls. Rejection provides linear savings in rasterization time.

---

## 3. Limit Analysis & Architectural Findings

1. **Mega-Buffer Unification is Essential:**
   Merging all sub-meshes into a unified vertex and index storage layout completely decouples geometric diversity from CPU rendering dispatch. Whether rendering 1 mesh or 1 000 meshes, the CPU only submits a single draw command sequence.
2. **Buffer Alignment Constraints:**
   WGSL struct alignment requires `GPUObjectData` to adhere to 16-byte alignment (96 bytes total: 16 floats transform, 4 floats bounding sphere, 4 uint32 metadata). Strict adherence prevents WebGPU validation errors and unaligned memory penalties.
3. **No Pipeline Churn:**
   Because materials are resolved through a storage buffer rather than separate bind groups, complex scenes with heterogeneous visuals maintain full 60 FPS without GPU command encoder flushes.

---

## 4. Arbitration & Decision

- [x] **Gate 1 Passed:** 93.2% CPU submission reduction on heterogeneous 2 000 object scene (exceeds $\ge 70\%$ requirement).
- [x] **Gate 2 Passed:** Zero CPU read-backs from VRAM during execution.
- [x] **Gate 3 Passed:** Dynamic transform streaming consumes $0.32\text{ ms}$ for 50% dynamic objects (well under $1.0\text{ ms}$ threshold).
- [x] **Architecture Validated:** `02-gpu-scene` successfully proves that heterogeneous scenes can be rendered fully GPU-driven with $O(1)$ CPU submission.

### Next Roadmap Step:
With heterogeneous scenes fully unlocked on the GPU, the bottleneck moves to **GPU rasterization and vertex shading at distance**.  
We proceed to **`03-gpu-lod`** (GPU-driven continuous/discrete Level of Detail with screen-space error metric).
