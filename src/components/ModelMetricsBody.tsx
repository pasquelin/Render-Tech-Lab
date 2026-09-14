import type { ReactNode } from 'react';
import type { CameraPose, FrameMetrics } from '@web-geometry/sdk/browser';
import type { ModelConfig } from '../lab/modelCampaign.ts';
import { LabStats } from './LabStats.tsx';
import { modelNumber as number } from './modelFormat.ts';
import { useModelPanel } from './useModelPanel.ts';
import { MetricGrid } from './ui/MetricGrid.tsx';

/** Point d'extension : un banc sans ModelView (banc 16 « Lumière ») décrit lui-même sa source. Sans
 *  `source`, le panneau lit le ModelView du banc 15 exactement comme avant. */
export type ModelMetricsSource = {
  readonly metrics: FrameMetrics | null;
  readonly frameIntervalMs: number | null;
  readonly cameraPose: CameraPose | null;
  readonly availableTriangles: number | null;
  readonly engine: string;
  readonly camera: ModelConfig['camera'];
  /** Le moteur affiché compte vraiment ses pages : sinon « Pages attachées » et « Pages évincées »
   *  restent « Non mesuré » plutôt que d'afficher les compteurs d'un autre chemin de rendu. */
  readonly exactPageCounters: boolean;
  /** Absent quand la scène n'est pas une copie multipliée : la provenance omet alors « Ville N ». */
  readonly startCity?: number;
};

const gameProvenance = 'collision sur triangles du modèle, saut et souris capturée';

function navigationLabel(camera: ModelConfig['camera']): string {
  switch (camera) {
    case 'orbit': return 'Orbite';
    case 'game': return 'Jeu';
    default: return 'Libre à pied';
  }
}

function navigationProvenance(camera: ModelConfig['camera'], startCity: number | undefined): string {
  switch (camera) {
    case 'orbit': return 'Rotation, zoom et translation';
    case 'game': return startCity === undefined ? gameProvenance : `Ville ${startCity + 1} · ${gameProvenance}`;
    default: return 'Horizon stable · W/A/S/D, R/F et regard souris';
  }
}

/** `extra` ajoute des blocs à la suite des blocs communs, sans rien changer au rendu du banc 15. */
export function ModelMetricsBody({ source, extra }: { source?: ModelMetricsSource; extra?: ReactNode }) {
  const { view, config } = useModelPanel();
  const resolved: ModelMetricsSource | null = source ?? (view ? {
    metrics: view.metrics, frameIntervalMs: view.frameIntervalMs, cameraPose: view.cameraPose,
    availableTriangles: view.availableTriangles, engine: config.engine, camera: config.camera,
    exactPageCounters: config.diagnostic === 'clusters' || config.diagnostic === 'pages' || config.engine !== 'three-webgl-reference',
    startCity: config.startCity ?? 0,
  } : null);
  if (!resolved) return null;
  const { metrics, exactPageCounters: exact, cameraPose: camera } = resolved;
  const stats = {
    submit: 'Non mesuré',
    cpuFrame: metrics ? `${number(metrics.cpuFrameMs, 2)} ms` : 'Non mesuré',
    fps: resolved.frameIntervalMs ? `${number(1000 / resolved.frameIntervalMs, 1)} FPS` : 'Non mesuré',
    drawCalls: number(metrics?.drawCalls),
  };
  const vector = (values: [number, number, number]) => values.map(value => number(value, 2)).join(' / ');
  return (
    <>
      <p className="text-xs font-mono text-primary" data-model-active-engine={resolved.engine}>Moteur affiché : {resolved.engine}</p>
      <LabStats stats={stats} provenance="1000 ÷ intervalle requestAnimationFrame (rAF)" />
      <MetricGrid items={[
        { label: 'Triangles disponibles', value: number(resolved.availableTriangles), provenance: 'Manifeste source × nombre d’instances du modèle' },
        { label: 'Triangles sélectionnés', value: number(metrics?.selectedTriangles), provenance: 'Feuilles exactes visibles, hors transparences partagées' },
        { label: 'Triangles soumis', value: number(metrics?.triangles), provenance: 'Compteur de rasterisation Three.js, passes incluses' },
        { label: 'Clusters visibles', value: number(metrics?.clusters), provenance: 'Hiérarchie CPU exacte' },
        { label: 'Pages demandées', value: number(metrics?.pagesRequested), provenance: 'Requêtes du streamer de pages' },
        { label: 'Pages lues', value: number(metrics?.pageLoads), provenance: 'Lectures vérifiées du cache CPU' },
        { label: 'Pages en cours', value: number(metrics?.pagesLoading) },
        { label: 'Pages attachées', value: exact ? number(metrics?.residentPages) : 'Non mesuré', provenance: 'Pages d’indices dans la scène ; pas VRAM physique' },
        { label: 'Pages évincées', value: exact ? number(metrics?.cacheEvictions) : 'Non mesuré' },
        { label: 'Cache hits / misses', value: metrics?.cacheHits==null&&metrics?.cacheMisses==null?'Non mesuré':`${number(metrics?.cacheHits)} / ${number(metrics?.cacheMisses)}` },
        { label: 'Frustum rejeté', value: number(metrics?.frustumRejected) },
        { label: 'Octets de géométrie comptabilisés', value: number(metrics?.geometryAllocationBytes), provenance: 'Tableaux uniques ; pas mémoire GPU physique' },
      ]} />
      <MetricGrid label="Caméra active" items={[
        { id: 'model-camera-position', label: 'Position X/Y/Z', value: camera ? vector(camera.position) : 'Non mesuré', provenance: 'Coordonnées monde' },
        { id: 'model-camera-target', label: 'Regarde vers X/Y/Z', value: camera ? vector(camera.target) : 'Non mesuré', provenance: 'Cible reconstruite depuis la direction de vue' },
        { id: 'model-camera-projection', label: 'Projection', value: camera ? `FOV ${number(camera.fov, 1)}° · plans ${number(camera.near, 2)}–${number(camera.far, 0)}` : 'Non mesuré', provenance: 'Champ de vision vertical ; plan proche–lointain' },
        { id: 'model-camera-mode', label: 'Navigation', value: navigationLabel(resolved.camera), provenance: navigationProvenance(resolved.camera, resolved.startCity) },
      ]} />
      {extra}
    </>
  );
}
