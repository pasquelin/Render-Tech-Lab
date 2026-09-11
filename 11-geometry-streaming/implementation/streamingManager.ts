/**
 * 11-geometry-streaming/implementation/streamingManager.ts
 *
 * Gestionnaire de streaming géométrique par pages avec cycle de vie VRAM strict :
 * cold -> loading -> partially-resident -> fully-resident -> eviction -> re-request.
 */

import type {
  ResidentState,
  StreamingConfig,
  StreamingFrameMetrics,
  StreamingLifecycle,
} from '../types.ts';

export interface GeometryPage {
  id: number;
  sizeBytes: number;
  state: ResidentState;
  lastAccessFrame: number;
}

export class GeometryStreamingManager {
  public config: StreamingConfig;
  public pages: Map<number, GeometryPage> = new Map();
  public currentFrame: number = 0;
  public residentBytes: number = 0;

  // Bande passante upload maximale allouée par trame (ex: 15 Mo/s @ 60 FPS = 250 Ko/trame)
  public uploadBudgetPerFrame: number;

  constructor(config: StreamingConfig, uploadBudgetPerFrame: number = 2 * 1024 * 1024) {
    this.config = config;
    this.uploadBudgetPerFrame = uploadBudgetPerFrame;
  }

  /**
   * Déclare un ensemble de pages géométriques disponibles sur disque/réseau (état initial : cold).
   */
  public registerPages(pageDefinitions: { id: number; sizeBytes: number }[]) {
    for (const def of pageDefinitions) {
      this.pages.set(def.id, {
        id: def.id,
        sizeBytes: def.sizeBytes,
        state: 'cold',
        lastAccessFrame: 0,
      });
    }
  }

  /**
   * Avance d'une trame et traite les requêtes de chargement sous contrainte de budget VRAM.
   */
  public processFrame(requestedPageIds: number[]): StreamingLifecycle {
    this.currentFrame++;
    const start = performance.now();

    let uploadedBytes = 0;
    let evictedBytes = 0;
    let stalls = 0;

    // 1. Mise à jour de l'accès pour les pages résidentes déjà chargées
    for (const id of requestedPageIds) {
      const page = this.pages.get(id);
      if (page && (page.state === 'fully-resident' || page.state === 'partially-resident')) {
        page.lastAccessFrame = this.currentFrame;
      }
    }

    // 2. Traitement des pages demandées non résidentes
    for (const id of requestedPageIds) {
      const page = this.pages.get(id);
      if (!page) continue;

      if (page.state === 'cold' || page.state === 'eviction') {
        const isReRequest = page.state === 'eviction';
        page.state = 'loading';

        // Si l'ajout dépasse le budget VRAM, évincer les pages LRU
        while (this.residentBytes + page.sizeBytes > this.config.vramBudgetBytes) {
          const evicted = this.evictLRUPage(requestedPageIds);
          if (!evicted) {
            // Impossible d'évincer (toutes les pages résidentes sont demandées dans la trame active)
            stalls++;
            break;
          }
          evictedBytes += evicted.sizeBytes;
        }

        // Upload si le budget de bande passante le permet
        if (uploadedBytes + page.sizeBytes <= this.uploadBudgetPerFrame) {
          uploadedBytes += page.sizeBytes;
          this.residentBytes += page.sizeBytes;
          page.state = 'fully-resident';
          page.lastAccessFrame = this.currentFrame;
        } else {
          // Upload partiel ou différé à la trame suivante
          page.state = 'partially-resident';
        }

        if (isReRequest && page.state === 'fully-resident') {
          page.state = 'fully-resident';
        }
      }
    }

    const duration = performance.now() - start;

    // Détermination de l'état global du streaming cette trame
    let overallState: ResidentState = 'fully-resident';
    const requestedPages = requestedPageIds.map((id) => this.pages.get(id)!).filter(Boolean);

    if (requestedPages.some((p) => p.state === 'cold')) overallState = 'cold';
    else if (requestedPages.some((p) => p.state === 'loading')) overallState = 'loading';
    else if (requestedPages.some((p) => p.state === 'partially-resident')) overallState = 'partially-resident';
    else if (evictedBytes > 0) overallState = 'eviction';

    const metrics: StreamingFrameMetrics = {
      residentBytes: this.residentBytes,
      uploadedBytes,
      evictedBytes,
      uploadTimeMs: null, // No transfer was executed on a GPU.
      frameTimeMs: Number(duration.toFixed(3)),
      stalls,
    };

    return {
      state: overallState,
      metrics,
    };
  }

  /**
   * Évince la page la moins récemment utilisée (LRU) non demandée cette trame.
   */
  private evictLRUPage(activeRequestedIds: number[]): GeometryPage | null {
    const activeSet = new Set(activeRequestedIds);
    let oldestPage: GeometryPage | null = null;
    let oldestFrame = Infinity;

    for (const page of this.pages.values()) {
      if (
        (page.state === 'fully-resident' || page.state === 'partially-resident') &&
        !activeSet.has(page.id)
      ) {
        if (page.lastAccessFrame < oldestFrame) {
          oldestFrame = page.lastAccessFrame;
          oldestPage = page;
        }
      }
    }

    if (oldestPage) {
      this.residentBytes -= oldestPage.sizeBytes;
      oldestPage.state = 'eviction';
      return oldestPage;
    }

    return null;
  }
}
