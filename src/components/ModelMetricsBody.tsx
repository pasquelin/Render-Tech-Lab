import type { ReactNode } from 'react';
import type { CameraPose } from '@web-geometry/sdk/browser';
import type { ModelConfig } from '../lab/modelCampaign.ts';
import { LabStats } from './LabStats.tsx';
import { modelNumber as number } from './modelFormat.ts';
import { useModelPanel } from './useModelPanel.ts';
import { MetricGrid } from './ui/MetricGrid.tsx';

/** Compteurs d'image lus par ce panneau. Volontairement plus large que FrameMetrics du SDK : un banc
 *  qui n'en publie qu'une partie laisse les autres absents et la case affiche « Non mesuré ». */
export type ModelMetricsFrame = {
  readonly cpuFrameMs?: number | null;
  readonly drawCalls?: number | null;
  readonly triangles?: number | null;
  readonly selectedTriangles?: number | null;
  readonly clusters?: number | null;
  readonly pagesRequested?: number | null;
  readonly pageLoads?: number | null;
  readonly pagesLoading?: number | null;
  readonly residentPages?: number | null;
  readonly cacheEvictions?: number | null;
  readonly cacheHits?: number | null;
  readonly cacheMisses?: number | null;
  readonly frustumRejected?: number | null;
  readonly geometryAllocationBytes?: number | null;
};

/** Point d'extension : un banc sans ModelView (banc 16 « Lumière ») décrit lui-même sa source. Sans
 *  `source`, le panneau lit le ModelView du banc 15 exactement comme avant. */
export type ModelMetricsSource = {
  readonly metrics: ModelMetricsFrame | null;
  readonly frameIntervalMs: number | null;
  readonly cameraPose: CameraPose | null;
  readonly availableTriangles: number | null;
  readonly engine: string;
  readonly diagnostic: ModelConfig['diagnostic'];
  readonly camera: ModelConfig['camera'];
  /** Absent quand la scène n'est pas une copie multipliée : la provenance omet alors « Ville N ». */
  readonly startCity?: number;
};

/** `extra` ajoute des blocs à la suite des blocs communs, sans rien changer au rendu du banc 15. */
export function ModelMetricsBody({ source, extra }: { source?: ModelMetricsSource; extra?: ReactNode } = {}) {
  const panel = useModelPanel();
  const view = panel.view;
  const resolved: ModelMetricsSource | null = source ?? (view ? {
    metrics: view.metrics, frameIntervalMs: view.frameIntervalMs, cameraPose: view.cameraPose,
    availableTriangles: view.availableTriangles, engine: panel.config.engine, diagnostic: panel.config.diagnostic,
    camera: panel.config.camera, startCity: panel.config.startCity ?? 0,
  } : null);
  if (!resolved) return null;
  const metrics = resolved.metrics;
  const exact = resolved.diagnostic === 'clusters' || resolved.diagnostic === 'pages' || resolved.engine !== 'three-webgl-reference';
  const stats = {
    submit: 'Non mesuré',
    cpuFrame: metrics?.cpuFrameMs == null ? 'Non mesuré' : `${number(metrics.cpuFrameMs, 2)} ms`,
    fps: resolved.frameIntervalMs ? `${number(1000 / resolved.frameIntervalMs, 1)} FPS` : 'Non mesuré',
    drawCalls: number(metrics?.drawCalls),
  };
  const camera = resolved.cameraPose;
  const vector = (values: [number, number, number]) => values.map(value => number(value, 2)).join(' / ');
  const gameProvenance = 'collision sur triangles du modèle, saut et souris capturée';
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
        { id: 'model-camera-mode', label: 'Navigation', value: resolved.camera === 'orbit' ? 'Orbite' : resolved.camera === 'game' ? 'Jeu' : 'Libre à pied', provenance: resolved.camera === 'orbit' ? 'Rotation, zoom et translation' : resolved.camera === 'game' ? (resolved.startCity === undefined ? gameProvenance : `Ville ${resolved.startCity + 1} · ${gameProvenance}`) : 'Horizon stable · W/A/S/D, R/F et regard souris' },
      ]} />
      {extra}
    </>
  );
}
