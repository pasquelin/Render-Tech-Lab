import { active, bounded } from '../scenarios/protocol.ts';
import { PAGE_BYTES, type ClusterAsset } from './geometryAsset.ts';

export interface PageSource { read(id:number,signal:AbortSignal):Promise<Uint8Array<ArrayBuffer>> }

/** Owns a real fixed GPU pool. Publication follows queue completion; eviction follows the last reader fence. */
export class PhysicalPages {
  readonly buffer: GPUBuffer;
  readonly slots = new Map<number, number>();
  readonly stats = { hits: 0, misses: 0, bytesRead: 0, uploadedBytes: 0, evictions: 0, loadMs: 0, fenceWaitMs: 0 };
  private clock = 0;
  private used = new Map<number, number>();
  private stopped = false;
  private busy = false;
  private lifetime = new AbortController();
  private source: PageSource;
  private device: GPUDevice; private asset: ClusterAsset; readonly capacity: number;
  constructor(device: GPUDevice, asset: ClusterAsset, capacity: number, source?: PageSource) {
    this.device=device;this.asset=asset;this.capacity=capacity;
    this.source=source??{async read(id,signal){active(signal);return asset.pages[id].slice();}};
    if (!Number.isInteger(capacity) || capacity < asset.regions.length || capacity > asset.pages.length) throw new Error('Pool must fit pinned roots');
    this.buffer = device.createBuffer({ size: capacity * PAGE_BYTES, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  }
  async request(ids: readonly number[], callerSignal: AbortSignal) {
    const signal=AbortSignal.any([callerSignal,this.lifetime.signal]);
    if(this.busy)throw new Error('Concurrent page requests are not supported');
    this.busy=true;
    try {
    active(signal); if (this.stopped) throw new Error('Pool disposed');
    for (const id of ids) if (!Number.isInteger(id) || !this.asset.pages[id]) throw new Error('Unknown page');
    // Deliberate conservative baseline: all readers finish before recycling any slot.
    const fence = performance.now(); await bounded(this.device.queue.onSubmittedWorkDone(), signal);
    this.stats.fenceWaitMs += performance.now() - fence; active(signal);
    const protectedPages = new Set(ids), roots = this.asset.regions.length;
    for (const id of new Set(ids)) {
      active(signal); this.clock++;
      if (this.slots.has(id)) { this.stats.hits++; this.used.set(id, this.clock); continue; }
      this.stats.misses++;
      const occupied=new Set(this.slots.values());
      let slot=Array.from({length:this.capacity},(_,i)=>i).find(i=>!occupied.has(i))??-1;
      if (this.slots.size === this.capacity) {
        const victim = [...this.slots.keys()].filter(p => p >= roots && !protectedPages.has(p)).sort((a, b) => this.used.get(a)! - this.used.get(b)!)[0];
        if (victim === undefined) continue; // All slots pinned/requested: keep complete coarse fallback.
        slot = this.slots.get(victim)!; this.slots.delete(victim); this.used.delete(victim); this.stats.evictions++;
      }
      const started = performance.now();
      const payload = await bounded(this.source.read(id,signal),signal);
      active(signal);
      if(payload.byteLength!==PAGE_BYTES||payload.some((v,i)=>v!==this.asset.pages[id][i]))throw new Error('Page integrity mismatch');
      this.stats.bytesRead += payload.byteLength;
      this.device.queue.writeBuffer(this.buffer, slot * PAGE_BYTES, payload);
      this.stats.uploadedBytes += payload.byteLength;
      await bounded(this.device.queue.onSubmittedWorkDone(), signal); active(signal);
      this.slots.set(id, slot); this.used.set(id, this.clock); this.stats.loadMs += performance.now() - started;
    }
    } finally {this.busy=false;}
  }
  table(): Uint32Array<ArrayBuffer> {
    const n = this.asset.regions.length, table = new Uint32Array(n * 2);
    for (let i = 0; i < n; i++) { const root = this.slots.get(i); if (root === undefined) throw new Error('Pinned root unavailable');
      table[i * 2] = root; table[i * 2 + 1] = this.slots.get(n + i) ?? 0xffffffff; }
    return table;
  }
  dispose() { this.stopped = true; this.lifetime.abort(); this.buffer.destroy(); this.slots.clear(); this.used.clear(); }
}
