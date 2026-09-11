# R&D Protocol: Virtual Shadow Maps (VSM)

> **Governing rule:** the engine only grows more complex once a reproducible measurement proves that the current architecture is genuinely limiting the product.

---

## 1. Hypothesis
- **Problem observed:** 
- **Technical hypothesis:** 
- **Trigger threshold:** 
- **Expected gain (quantified KPI):** 

---

## 2. Prototype
- **Bench description:** 
- **Isolation boundary:** 
- **Branch / source files:** 

---

## 3. Benchmark
- **Test scenario:** (e.g. S0, S1, S2, S3, S4, S5)
- **Target hardware:** (OS, GPU, WebGPU runtime / browser)
- **Metrics recorded:**
  - CPU frame / submit time (`ms`)
  - GPU frame time (`ms`)
  - P95 / P99 (`ms`)
  - VRAM usage (`MB`)
  - Visual quality (RMS / golden still)

---

## 4. Profiling
- **Tools used:** (Chrome Tracing, PIX / RenderDoc / Metal System Trace, WebGPU timestamps)
- **Bottleneck observations:** 
- **Thermal behaviour & stability:** 

---

## 5. Gain
- **Raw results:**
  - Baseline: `... ms`
  - Prototype: `... ms`
  - Delta: `... %`
- **Hypothesis confirmed:** [ ] Validated / [ ] Invalidated

---

## 6. Cost
- **Code complexity:** (lines of code, dependencies, maintenance cost)
- **Memory / bandwidth overhead:** 
- **Integration cost:** (impact on the existing render pipeline)

---

## 7. Decision
- **Verdict:** [ ] Merge into the main engine / [ ] Keep on the watchlist / [ ] Drop
- **Rationale:** 
- **Next steps:** 
