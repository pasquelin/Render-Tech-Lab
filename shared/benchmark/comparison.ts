import { TimestampBatch } from '../gpu/timing.ts';

export interface BenchmarkStrategy {
  readonly id: string;
  render(frame: number, timer?: TimestampBatch, sample?: number): void;
  verify(): Promise<void>;
  dispose(): void;
}
export interface ComparisonConfig { warmup: number; samples: number; blocks: number; forceFallback?: boolean }
export interface ComparisonResult {
  variant: string;
  method: 'timestamp-query' | 'queue-completion';
  cpuMs: number[];
  gpuMs: (number | null)[];
  completionMs: (number | null)[];
  validSamples: number;
  resolutionLimitedSamples: number;
}

/** One promise and one stable callback per sequence, not per rAF. */
export function runFrames(count: number, frame: (index: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let i = 0;
    function tick() {
      try { frame(i++); }
      catch (error) { reject(error); return; }
      if (i === count) resolve(); else requestAnimationFrame(tick);
    }
    if (count === 0) resolve(); else requestAnimationFrame(tick);
  });
}

/** Same queue, input frame indices and protocol; counterbalanced by block. */
export async function compareStrategies(device: GPUDevice, strategies: readonly BenchmarkStrategy[],
  config: ComparisonConfig): Promise<ComparisonResult[]> {
  if (!strategies.length || new Set(strategies.map(s => s.id)).size !== strategies.length
    || !Number.isInteger(config.warmup) || config.warmup < 0
    || !Number.isInteger(config.samples) || config.samples < 1 || config.samples > 2048
    || !Number.isInteger(config.blocks) || config.blocks < 1) throw new Error('Protocole invalide');
  const timed = device.features.has('timestamp-query') && !config.forceFallback;
  const total = config.samples * config.blocks;
  const storage = strategies.map(() => ({ cpu: new Float64Array(total), gpu: new Float64Array(total).fill(NaN),
    completion: new Float64Array(total).fill(NaN), limited: 0 }));
  let lost = false;
  void device.lost.then(() => { lost = true; });
  for (const strategy of strategies) await strategy.verify();
  for (let block = 0; block < config.blocks; block++) {
    for (let step = 0; step < strategies.length; step++) {
      const v = (step + block) % strategies.length;
      const strategy = strategies[v], data = storage[v], offset = block * config.samples;
      const timer = timed ? new TimestampBatch(device, config.samples, 2) : undefined;
      try {
        await runFrames(config.warmup, i => strategy.render(i));
        await device.queue.onSubmittedWorkDone();
        if (timer) {
          timer.begin(config.samples);
          await runFrames(config.samples, i => {
            if (lost) throw new Error('GPU device lost');
            const start = performance.now();
            strategy.render(i, timer, i);
            data.cpu[offset + i] = performance.now() - start;
          });
          await timer.collect();
          for (let i = 0; i < config.samples; i++) {
            const span = timer.frameSpanMs[i];
            if (!Number.isFinite(span)) throw new Error(`Invalid timestamp sample for ${strategy.id} frame ${i}: passes ${timer.passMs[i * 2]}, ${timer.passMs[i * 2 + 1]}`);
            data.gpu[offset + i] = span;
            if (span === 0) data.limited++;
          }
        } else {
          // Serialized latency fallback, explicitly distinguished from GPU timestamps.
          for (let i = 0; i < config.samples; i++) {
            const start = performance.now();
            strategy.render(i);
            data.cpu[offset + i] = performance.now() - start;
            await device.queue.onSubmittedWorkDone();
            data.completion[offset + i] = performance.now() - start;
          }
        }
        if (lost) throw new Error('GPU device lost');
        await strategy.verify();
      } finally { timer?.destroy(); }
    }
  }
  return strategies.map((strategy, i) => ({ variant: strategy.id,
    method: timed ? 'timestamp-query' : 'queue-completion',
    cpuMs: Array.from(storage[i].cpu),
    gpuMs: Array.from(storage[i].gpu, x => Number.isFinite(x) ? x : null),
    completionMs: Array.from(storage[i].completion, x => Number.isFinite(x) ? x : null),
    validSamples: total, resolutionLimitedSamples: storage[i].limited,
  }));
}
