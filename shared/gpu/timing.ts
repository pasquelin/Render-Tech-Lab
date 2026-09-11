type State = 'idle' | 'encoding' | 'resolved' | 'submitted' | 'mapping' | 'failed' | 'destroyed';

export class TimestampBatch {
  readonly capacity: number;
  readonly passCount: number;
  readonly passMs: Float64Array;
  readonly frameSpanMs: Float64Array;
  // 0: positive delta; 1: zero/resolution-limited; 2: invalid delta.
  readonly quality: Uint8Array;
  private readonly query: GPUQuerySet;
  private readonly resolveBuffer: GPUBuffer;
  private readonly readBuffer: GPUBuffer;
  private readonly descriptors: GPUComputePassTimestampWrites[];
  private readonly used: Uint8Array;
  private state: State = 'idle';
  private frames = 0;
  private lost = false;

  constructor(
    device: GPUDevice,
    capacity: number,
    passCount: number,
  ) {
    this.capacity = capacity; this.passCount = passCount;
    if (!device.features.has('timestamp-query')) throw new Error('Feature not enabled on device');
    if (!Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(passCount) || passCount < 1
      || capacity * passCount * 2 > 8192) throw new Error('Invalid query capacity');
    const pairs = capacity * passCount;
    this.query = device.createQuerySet({ type: 'timestamp', count: pairs * 2 });
    this.resolveBuffer = device.createBuffer({
      size: pairs * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    this.readBuffer = device.createBuffer({
      size: pairs * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    this.descriptors = Array.from({ length: pairs }, (_, i) => ({
      querySet: this.query, beginningOfPassWriteIndex: i * 2, endOfPassWriteIndex: i * 2 + 1,
    }));
    this.used = new Uint8Array(pairs);
    this.passMs = new Float64Array(pairs);
    this.frameSpanMs = new Float64Array(capacity);
    this.quality = new Uint8Array(pairs);
    const owner = new WeakRef(this);
    void device.lost.then(() => { const batch = owner.deref(); if (batch) batch.lost = true; });
  }

  begin(frames: number): void {
    this.expect('idle');
    if (!Number.isInteger(frames) || frames < 1 || frames > this.capacity) throw new Error('Invalid frame count');
    this.frames = frames;
    this.used.fill(0);
    this.passMs.fill(NaN);
    this.frameSpanMs.fill(NaN);
    this.quality.fill(2);
    this.state = 'encoding';
  }

  // Use each returned descriptor exactly once, on one pass that is then ended.
  // Also structurally compatible with GPURenderPassTimestampWrites.
  writes(frame: number, pass: number): GPUComputePassTimestampWrites {
    this.expect('encoding');
    if (!Number.isInteger(frame) || frame < 0 || frame >= this.frames
      || !Number.isInteger(pass) || pass < 0 || pass >= this.passCount) throw new Error('Invalid query index');
    const i = frame * this.passCount + pass;
    if (this.used[i]) throw new Error('Query pair reused');
    this.used[i] = 1;
    return this.descriptors[i];
  }

  // Called after the last measured pass, before finishing its encoder.
  resolve(encoder: GPUCommandEncoder): void {
    this.expect('encoding');
    const pairs = this.frames * this.passCount;
    for (let i = 0; i < pairs; i++) if (!this.used[i]) throw new Error('Missing pass');
    // Resolve destination offset must be 256-byte aligned. Zero satisfies it.
    encoder.resolveQuerySet(this.query, 0, pairs * 2, this.resolveBuffer, 0);
    encoder.copyBufferToBuffer(this.resolveBuffer, 0, this.readBuffer, 0, pairs * 16);
    this.state = 'resolved';
  }

  // Call immediately after submitting the command buffer containing resolve().
  submitted(): void { this.expect('resolved'); this.state = 'submitted'; }

  async collect(): Promise<void> {
    this.expect('submitted');
    this.state = 'mapping';
    let mapped = false;
    try {
      const pairs = this.frames * this.passCount;
      await this.readBuffer.mapAsync(GPUMapMode.READ, 0, pairs * 16);
      mapped = true;
      if (this.lost) throw new Error('Device lost during batch');
      const ns = new BigUint64Array(this.readBuffer.getMappedRange(0, pairs * 16));
      for (let i = 0; i < pairs; i++) {
        const delta = ns[i * 2 + 1] - ns[i * 2];
        if (delta < 0n || delta > BigInt(Number.MAX_SAFE_INTEGER)) continue;
        this.passMs[i] = Number(delta) / 1e6;
        this.quality[i] = delta === 0n ? 1 : 0;
      }
      // Envelope, not sum of passes: preserves gaps between consecutive stages.
      for (let f = 0; f < this.frames; f++) {
        const start = f * this.passCount * 2;
        const end = start + this.passCount * 2 - 1;
        let valid = true;
        for (let q = start; q < end; q++) if (ns[q + 1] < ns[q]) valid = false;
        const delta = ns[end] - ns[start];
        if (valid && delta >= 0n && delta <= BigInt(Number.MAX_SAFE_INTEGER)) {
          this.frameSpanMs[f] = Number(delta) / 1e6;
        }
      }
      this.state = 'idle';
    } catch (error) {
      this.state = 'failed';
      throw error;
    } finally {
      if (mapped) this.readBuffer.unmap();
    }
  }

  // After queue drain/collect, or on abort/device loss. Cancels pending mapping.
  destroy(): void {
    this.state = 'destroyed';
    this.query.destroy(); this.resolveBuffer.destroy(); this.readBuffer.destroy();
  }

  private expect(state: State): void {
    if (this.lost) throw new Error('Device lost');
    if (this.state !== state) throw new Error(`Expected ${state}, got ${this.state}`);
  }
}

export interface CompletionSample {
  frames: number;
  cpuEncodeSubmitMs: number;
  queueWallMs: number;
  gpuMs: null;
  method: 'queue-completion';
}

// Dedicated queue, no concurrent producer; encodeAndSubmit performs REAL frames.
// Out is caller-owned. Keep count/queue depth identical across variants.
// This measures a block's completed throughput, NOT a per-frame GPU percentile.
export async function measureCompletionBlock(
  device: GPUDevice,
  frames: number,
  encodeAndSubmit: (index: number) => void,
  out: CompletionSample,
): Promise<void> {
  if (!Number.isInteger(frames) || frames < 1) throw new Error('Invalid frame count');
  await device.queue.onSubmittedWorkDone();
  const start = performance.now();
  for (let i = 0; i < frames; i++) encodeAndSubmit(i);
  const submitted = performance.now();
  await device.queue.onSubmittedWorkDone();
  const completed = performance.now();
  out.frames = frames;
  out.cpuEncodeSubmitMs = submitted - start;
  out.queueWallMs = completed - start;
  out.gpuMs = null;
  out.method = 'queue-completion';
}
