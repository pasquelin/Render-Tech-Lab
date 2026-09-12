import type { GeometryPageDefinition, ResidentState, StreamingConfig, StreamingFrameMetrics, StreamingProgress } from '../contracts.ts';

export interface GeometryPage extends GeometryPageDefinition {
  state: ResidentState; lastAccessFrame: number; requestGeneration: number; residentPayloadBytes: number;
}

function checkInteger(value: number, label: string, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError(`${label} is invalid`);
}

export class GeometryStreamingManager {
  public readonly pages = new Map<number, GeometryPage>();
  public currentFrame = 0;
  public residentBytes = 0;
  public readonly config: StreamingConfig;
  public readonly uploadBudgetPerFrame: number;
  private generation = 0;
  private readonly protectedByGeneration = new Map<number, Set<number>>();

  constructor(config: StreamingConfig, uploadBudgetPerFrame = 2 * 1024 * 1024) {
    checkInteger(config.vramBudgetBytes, 'vramBudgetBytes', 1);
    checkInteger(uploadBudgetPerFrame, 'uploadBudgetPerFrame', 1);
    this.config = config;
    this.uploadBudgetPerFrame = uploadBudgetPerFrame;
  }

  registerPages(definitions: GeometryPageDefinition[]): void {
    for (const definition of definitions) {
      checkInteger(definition.id, 'page id'); checkInteger(definition.sizeBytes, 'page size', 1);
      if (definition.sizeBytes > this.config.vramBudgetBytes) throw new RangeError('page exceeds logical residency budget');
      if (this.pages.has(definition.id)) throw new Error(`duplicate page ${definition.id}`);
      this.pages.set(definition.id, { ...definition, state: 'cold', lastAccessFrame: -1, requestGeneration: 0, residentPayloadBytes: 0 });
    }
    for (const page of this.pages.values()) if (page.fallbackPageId !== null && !this.pages.has(page.fallbackPageId)) throw new Error(`missing fallback page ${page.fallbackPageId}`);
  }

  requestPages(ids: readonly number[]): { generation: number; pageIds: number[] } {
    this.currentFrame++;
    const generation = ++this.generation;
    const pageIds = [...new Set(ids)];
    this.protectedByGeneration.set(generation, new Set(pageIds));
    for (const id of pageIds) {
      const page = this.pages.get(id);
      if (!page) throw new Error(`unknown page ${id}`);
      page.lastAccessFrame = this.currentFrame;
      if (page.state !== 'fully-resident') {
        page.state = page.state === 'eviction' ? 're-request' : 'loading';
        page.requestGeneration = generation;
      }
    }
    return { generation, pageIds };
  }

  completeUpload(id: number, generation: number, uploadedBytes?: number): boolean {
    const page = this.pages.get(id);
    if (!page) throw new Error(`unknown page ${id}`);
    if (generation !== page.requestGeneration || !['loading', 'partially-resident', 're-request'].includes(page.state)) return false;
    const remaining = page.sizeBytes - page.residentPayloadBytes;
    const accepted = Math.min(uploadedBytes ?? remaining, remaining);
    checkInteger(accepted, 'uploadedBytes');
    this.ensureCapacity(accepted, this.protectedByGeneration.get(generation) ?? new Set([id]));
    page.residentPayloadBytes += accepted;
    this.residentBytes += accepted;
    page.state = page.residentPayloadBytes === page.sizeBytes ? 'fully-resident' : 'partially-resident';
    page.lastAccessFrame = this.currentFrame;
    return true;
  }

  resolveCut(ids: readonly number[]): { pageIds: number[]; missingPageIds: number[]; complete: boolean } {
    const selected = new Set<number>(); const missing: number[] = []; let complete = true;
    for (const id of ids) {
      const page = this.pages.get(id); if (!page) throw new Error(`unknown page ${id}`);
      if (page.state === 'fully-resident') selected.add(id);
      else {
        missing.push(id);
        const fallback = page.fallbackPageId === null ? null : this.pages.get(page.fallbackPageId);
        if (fallback?.state === 'fully-resident') selected.add(fallback.id); else complete = false;
      }
    }
    return { pageIds: [...selected].sort((a, b) => a - b), missingPageIds: missing, complete };
  }

  processFrame(requestedPageIds: number[]): { state: ResidentState; metrics: StreamingFrameMetrics } {
    const request = this.requestPages(requestedPageIds);
    const before = this.residentBytes;
    let uploadedBytes = 0;
    for (const id of request.pageIds) {
      const page = this.pages.get(id)!;
      if (page.state === 'fully-resident') continue;
      const available = this.uploadBudgetPerFrame - uploadedBytes;
      if (available <= 0) break;
      const accepted = Math.min(available, page.sizeBytes - page.residentPayloadBytes);
      this.completeUpload(id, request.generation, accepted);
      uploadedBytes += accepted;
    }
    const evictedBytes = Math.max(0, before + uploadedBytes - this.residentBytes);
    const requested = request.pageIds.map((id) => this.pages.get(id)!);
    const state: ResidentState = evictedBytes > 0 ? 'eviction'
      : requested.every((page) => page.state === 'fully-resident') ? 'fully-resident' : 'partially-resident';
    return { state, metrics: { residentBytes: this.residentBytes, uploadedBytes, evictedBytes,
      uploadTimeMs: null, frameTimeMs: null, stalls: state === 'partially-resident' ? 1 : 0 } };
  }

  private ensureCapacity(bytes: number, protectedIds: Set<number>): void {
    while (this.residentBytes + bytes > this.config.vramBudgetBytes) {
      const candidate = [...this.pages.values()].filter((page) => page.residentPayloadBytes > 0 && !page.pinned && !protectedIds.has(page.id))
        .sort((a, b) => a.lastAccessFrame - b.lastAccessFrame || a.id - b.id)[0];
      if (!candidate) throw new Error('residency budget cannot satisfy request without evicting pinned data');
      this.residentBytes -= candidate.residentPayloadBytes; candidate.residentPayloadBytes = 0; candidate.state = 'eviction';
    }
  }
}

export interface StreamingCampaignOptions {
  pages: GeometryPageDefinition[]; frames: number[][]; vramBudgetBytes: number; uploadBudgetPerFrame: number;
  signal?: AbortSignal; onProgress?: (event: StreamingProgress) => void;
  loader: (page: GeometryPageDefinition, generation: number, signal?: AbortSignal) => Promise<{ byteLength: number }>;
}

export async function runStreamingCampaign(options: StreamingCampaignOptions): Promise<{
  frames: Array<{ requested: number[]; generation: number; cut: ReturnType<GeometryStreamingManager['resolveCut']>; metrics: StreamingFrameMetrics }>;
  memory: { logicalResidentBytes: number; ramBytes: null; gpuBytes: null };
}> {
  const manager = new GeometryStreamingManager({ requestedFraction: 100, vramBudgetBytes: options.vramBudgetBytes }, options.uploadBudgetPerFrame);
  manager.registerPages(options.pages);
  const records: Array<{ requested: number[]; generation: number; cut: ReturnType<GeometryStreamingManager['resolveCut']>; metrics: StreamingFrameMetrics }> = [];
  for (let frame = 0; frame < options.frames.length; frame++) {
    if (options.signal?.aborted) throw new DOMException('Streaming campaign aborted', 'AbortError');
    const requested = options.frames[frame];
    options.onProgress?.({ stage: 'request', frame, completed: frame, total: options.frames.length });
    const request = manager.requestPages(requested); let uploadedBytes = 0; const before = manager.residentBytes;
    for (const id of request.pageIds) {
      const page = manager.pages.get(id)!; if (page.state === 'fully-resident') continue;
      const remainingBudget = options.uploadBudgetPerFrame - uploadedBytes; if (remainingBudget <= 0) break;
      options.onProgress?.({ stage: 'upload', frame, completed: frame, total: options.frames.length });
      const payload = await options.loader(page, request.generation, options.signal);
      if (options.signal?.aborted) throw new DOMException('Streaming campaign aborted', 'AbortError');
      if (payload.byteLength !== page.sizeBytes) throw new Error(`loader returned wrong byte length for page ${id}`);
      const accepted = Math.min(payload.byteLength, remainingBudget);
      manager.completeUpload(id, request.generation, accepted); uploadedBytes += accepted;
    }
    const cut = manager.resolveCut(requested);
    options.onProgress?.({ stage: 'resolve', frame, completed: frame + 1, total: options.frames.length });
    records.push({ requested: [...requested], generation: request.generation, cut, metrics: {
      residentBytes: manager.residentBytes, uploadedBytes, evictedBytes: Math.max(0, before + uploadedBytes - manager.residentBytes),
      uploadTimeMs: null, frameTimeMs: null, stalls: cut.complete ? 0 : 1,
    } });
  }
  options.onProgress?.({ stage: 'complete', frame: options.frames.length, completed: options.frames.length, total: options.frames.length });
  return { frames: records, memory: { logicalResidentBytes: manager.residentBytes, ramBytes: null, gpuBytes: null } };
}
