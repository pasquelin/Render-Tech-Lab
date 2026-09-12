import { runVirtualizedCampaign } from '../implementation/virtualizedCampaign.ts';
import type { IntegratedBenchRunner, IntegratedRunOptions, IntegratedRunResult, IntegratedMetric } from '../../shared/benchmark/integratedRunners.ts';
import { TEST_ID, blockedScenarios, configuration, active, type ControlConfig } from '../scenarios/protocol.ts';
import { runResidentControl } from '../implementation/control.ts';

export interface IntegrationOptions extends IntegratedRunOptions {
  control?: Partial<ControlConfig>;
  mode?: 'virtualized' | 'resident-control';
  /** False explicitly suppresses the physical diagnostic. */
  runControl?: boolean;
}
export interface IntegrationArchive {
  schema: 1; test: typeof TEST_ID; createdAt: string; configuration: ControlConfig;
  architectureStatus: 'blocked' | 'procedural-validated'; verdict: 'not-yet-decided';
  scenarios: ReturnType<typeof blockedScenarios>;
  environment: Record<string, unknown>;
  provenance: Record<string, string>;
  control: Awaited<ReturnType<typeof runResidentControl>> | null;
  virtualized?: Awaited<ReturnType<typeof runVirtualizedCampaign>>;
  errors: string[];
}
export interface IntegrationResult extends IntegratedRunResult { archive: IntegrationArchive }

export function createVirtualizedIntegrationRunner(): Omit<IntegratedBenchRunner, 'run'> & {
  run(options?: IntegrationOptions): Promise<IntegrationResult>;
} {
  let running = false;
  return {
    id: TEST_ID, variants: ['A-source-triangles', 'B-cluster-pages'],
    async run(options: IntegrationOptions = {}): Promise<IntegrationResult> {
      if (running) throw new Error('Integration runner already running');
      const config = configuration({ ...options.control,
        ...(options.samples === undefined ? {} : { samples: options.samples }),
        ...(options.warmup === undefined ? {} : { warmup: options.warmup }) });
      const controller = new AbortController();
      const relay = () => controller.abort(options.signal?.reason);
      options.signal?.addEventListener('abort', relay, { once: true });
      if (options.signal?.aborted) relay();
      const timeout = setTimeout(() => controller.abort(new DOMException('Integration deadline exceeded', 'TimeoutError')), config.timeoutMs);
      const archive: IntegrationArchive = { schema: 1, test: TEST_ID, createdAt: new Date().toISOString(), configuration: config,
        architectureStatus: 'blocked', verdict: 'not-yet-decided', scenarios: blockedScenarios(), control: null, errors: [],
        environment: { userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
          features: options.device ? [...options.device.features] : [],
          adapterInfo: options.device?.adapterInfo ? { vendor: options.device.adapterInfo.vendor,
            architecture: options.device.adapterInfo.architecture, device: options.device.adapterInfo.device,
            description: options.device.adapterInfo.description } : null,
          hardwareClassification: 'unverified; smoke harness records browser GPU system info',
          resolution: [config.width, config.height] },
        provenance: {
          cpuFrameMs: 'performance.now around camera update and renderFrame; excludes RAF waiting and readbacks',
          submitMs: 'existing renderer encoder creation through queue.submit; includes encoding',
          gpuMs: 'TimestampBatch raster-only for A, first compute start to raster end for B; null without queries; zero is resolution limited',
          fps: '1000 / mean of consecutive RAF intervals within each block; not display presentation',
          drawCalls: 'instrumented renderer API calls; not hardware draw execution counter',
          submittedTriangles: 'verified replay visible instance count times actual index count / 3; derived, not GPU hardware counter',
          clusters: 'null: this control renders instances, not a virtualized cluster cut',
          image: 'exact RGBA8 A/A/B comparisons and SHA-256 at every sampled pose, outside timing',
          memory: 'RAM/VRAM null: physical memory not instrumented',
          streaming: 'cache hits/misses, bytes read and decode/load times null: no loader in resident procedural control',
          preparation: 'CPU scene construction; GPU resource construction + queue completion separately',
          firstImage: 'firstGpuCompleteMs is first submitted frame completion, not presentation latency',
          conclusion: 'Diagnostic only. No gain ratio or architecture adoption verdict.',
        } };
      const records: IntegratedMetric[] = [];
      running = true;
      try {
        active(controller.signal);
        if (options.runControl === false || !options.device || !options.canvas) {
          return { test: TEST_ID, status: 'not-run', reason: 'Architecture blocked; physical control disabled or device/canvas absent', records,
            gates: { correctness: null, detail: 'No rendering executed.' }, archive };
        }
        if(options.mode !== 'resident-control') {
          archive.virtualized=await runVirtualizedCampaign({...options,signal:controller.signal});
          const passed=archive.virtualized.status==='measured';
          archive.architectureStatus=passed?'procedural-validated':'blocked';
          return {test:TEST_ID,status:passed?'measured':'not-run',reason:passed?'Procedural virtualized fixture verified; general scenarios remain blocked':archive.virtualized.errors.join('\n'),records:passed?archive.virtualized.metrics:[],gates:{correctness:passed,detail:archive.virtualized.scope},archive};
        }
        const weakController = new WeakRef(controller);
        void options.device.lost.then(info => weakController.deref()?.abort(new Error(`Device lost: ${info.message || info.reason}`)));
        archive.control = await runResidentControl(options.device, options.canvas, config, controller.signal, {
          phase(phase, variant, completed, total) {
            const event = { test: TEST_ID, phase, variant, completed, total, message: `${phase}: resident control ${variant}` };
            options.onPhase?.(event); options.onProgress?.(event);
          },
        });
        const passed = archive.control.status === 'measured';
        if (passed) for (const block of archive.control.blocks) {
          const metric: IntegratedMetric = { test: TEST_ID, variant: `${block.mode}:${block.block}`, cpuMs: block.cpuFrameMs?.mean ?? null,
            gpuMs: block.gpuMs?.mean ?? null,
            custom: { scope: 'resident-instance-control-only', architectureStatus: 'blocked', fps: block.cadence.fps,
              p95Ms: block.cadence.frameMs?.p95 ?? null, p99Ms: block.cadence.frameMs?.p99 ?? null,
              submitMs: block.submitMs?.mean ?? null, ramBytes: null, vramBytes: null, visibleClusters: null,
              submittedClusters: null, cacheHits: null, cacheMisses: null, bytesRead: null, loadMs: null, decodeMs: null } };
          records.push(metric); options.onMetrics?.(metric);
        }
        const event = { test: TEST_ID, phase: 'complete' as const, completed: 1, total: 1,
          message: passed ? 'Control completed; virtualized architecture still blocked' : 'Control failed; archive retained' };
        options.onPhase?.(event); options.onProgress?.(event);
        return { test: TEST_ID, status: passed ? 'measured' : 'not-run', reason: passed ? 'Only the resident instance control was measured' : archive.control.reason,
          records, gates: { correctness: passed ? true : false, detail: 'Gate covers resident control only; no virtualized pipeline equivalence established.' }, archive };
      } catch (error) {
        archive.errors.push(String(error));
        return { test: TEST_ID, status: 'not-run', reason: String(error), records: [],
          gates: { correctness: null, detail: 'Interrupted/failed; no performance verdict.' }, archive };
      } finally {
        clearTimeout(timeout); options.signal?.removeEventListener('abort', relay); running = false;
      }
    },
  };
}
