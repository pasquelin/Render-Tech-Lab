# Reference Floor Report: 00-baseline

**Scope:** standard Three.js reference engine
**Last updated:** 2026-09-11 16:43:47
**Goal:** establish the reference S0–S5 load curve, the zero point every R&D module is measured against.

> **Governing rule:** no major infrastructure is adopted until a bench proves the current architecture is the limiting factor.

---

## 1. Official S0–S5 load curve (standard Three.js)

| Scenario | Name | Objects | Instanced | Lights | CPU submit | CPU frame | Draw calls | Dominant bottleneck |
|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **S0** | Minimal baseline | 1 | No | 1 | **0.08 ms** | 0.45 ms | 2 | None |
| **S1** | 500 instanced | 500 | Yes | 2 | **0.12 ms** | 0.65 ms | 3 | None |
| **S2** | 1 000 instanced | 1000 | Yes | 2 | **0.18 ms** | 0.85 ms | 3 | None |
| **S3** | 2 000 unique | 2000 | No | 2 | **3.35 ms** | 4.15 ms | 2002 | CPU submission |
| **S4** | 30 dynamic lights | 200 | Yes | 30 | **0.45 ms** | 1.95 ms | 31 | GPU |
| **S5** | Hostile | 5000 | No | 8 | **8.45 ms** | 10.20 ms | 5008 | CPU submission |

---

## 2. Findings & R&D triggers

1. **The S3 CPU knee (2 000 unique objects):**
   - On S1 and S2 (instanced), the engine copes without effort ($\text{submit} < 0.2\,\text{ms}$).
   - As soon as the objects become unique (S3), submission time explodes to **$3.35\,\text{ms}$** for $2\,000$ draw calls.
   - **R&D decision:** this precise knee is what justifies opening the [**01-gpu-driven**](../01-gpu-driven/README.md) module.

2. **The S4 pass stress (30 lights):**
   - Submission stays contained, but GPU frametime rises.
   - **R&D decision:** tracked by the [**04-lumen-inspired**](../04-lumen-inspired/README.md) module.

3. **The S5 hostile scenario:**
   - Severe breakdown ($8.45\,\text{ms}$ of CPU submission).
   - Justifies the combined techniques: GPU-driven rendering, automatic LODs (meshoptimizer) and Hi-Z.
