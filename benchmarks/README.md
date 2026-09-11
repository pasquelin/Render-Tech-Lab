# Shared Benchmarks

This folder holds the standardised measurement harnesses that every architecture module reuses.

## Measurement categories
- `cpu/` — CPU submission load, command encoding time, garbage collection and multi-thread/worker impact.
- `gpu/` — GPU frame-time profiling (`timestamp-query`), per-pass cost and compute shader execution time.
- `memory/` — VRAM footprint, buffer/texture allocations, memory leaks and bandwidth.
- `image-quality/` — validation through root-mean-square deviation (RMS), PSNR, SSIM and differential comparison against the golden stills.

## Reference load scenarios (S0–S5 curve)
- **S0** — minimal baseline
- **S1** — 500 instanced objects
- **S2** — 1 000 instanced objects
- **S3** — 2 000 unique objects (CPU submission stress)
- **S4** — 30 dynamic lights (GPU pass stress)
- **S5** — hostile scenario (dense geometry, dynamic lights and shadows combined)
