import { LabStats } from './LabStats.tsx';
import { modelNumber as number } from './modelFormat.ts';
import { useModelPanel } from './useModelPanel.ts';
import { MetricGrid } from './ui/MetricGrid.tsx';

export function ModelMetricsBody() {
  const { view, config } = useModelPanel();
  if (!view) return null;
  const metrics = view.metrics;
  const exact = config.diagnostic === 'clusters' || config.diagnostic === 'pages' || config.engine !== 'three-webgl-reference';
  const stats = {
    submit: 'Non mesuré',
    cpuFrame: metrics ? `${number(metrics.cpuFrameMs, 2)} ms` : 'Non mesuré',
    fps: view.frameIntervalMs ? `${number(1000 / view.frameIntervalMs, 1)} FPS` : 'Non mesuré',
    drawCalls: number(metrics?.drawCalls),
  };
  const camera = view.cameraPose;
  const vector = (values: [number, number, number]) => values.map(value => number(value, 2)).join(' / ');
  return (
    <>
      <p className="text-xs font-mono text-primary" data-model-active-engine={config.engine}>Moteur affiché : {config.engine}</p>
      <LabStats stats={stats} provenance="1000 ÷ intervalle requestAnimationFrame (rAF)" />
      <MetricGrid items={[
        { label: 'Triangles disponibles', value: number(view.availableTriangles), provenance: 'Manifeste source × nombre d’instances du modèle' },
        { label: 'Triangles sélectionnés', value: number(metrics?.selectedTriangles), provenance: 'Feuilles exactes visibles, hors transparences partagées' },
        { label: 'Triangles soumis', value: number(metrics?.triangles), provenance: 'Compteur de rasterisation Three.js, passes incluses' },
        { label: 'Clusters visibles', value: number(metrics?.clusters), provenance: 'Hiérarchie CPU exacte' },
        { label: 'Pages demandées', value: number(metrics?.pagesRequested), provenance: 'Requêtes du streamer de pages' },
        { label: 'Pages lues', value: number(metrics?.pageLoads), provenance: 'Lectures vérifiées du cache CPU' },
        { label: 'Pages en cours', value: number(metrics?.pagesLoading) },
        { label: 'Pages attachées', value: exact ? number(metrics?.residentPages) : 'Non mesuré', provenance: 'Pages d’indices dans la scène ; pas VRAM physique' },
        { label: 'Pages évincées', value: exact ? number(metrics?.pageEvictions) : 'Non mesuré' },
        { label: 'Cache hits / misses', value: metrics?.cacheHits==null&&metrics?.cacheMisses==null?'Non mesuré':`${number(metrics?.cacheHits)} / ${number(metrics?.cacheMisses)}` },
        { label: 'Frustum rejeté', value: number(metrics?.frustumRejected) },
        { label: 'Octets de géométrie comptabilisés', value: number(metrics?.geometryAllocationBytes), provenance: 'Tableaux uniques ; pas mémoire GPU physique' },
      ]} />
      <MetricGrid label="Caméra active" items={[
        { id: 'model-camera-position', label: 'Position X/Y/Z', value: camera ? vector(camera.position) : 'Non mesuré', provenance: 'Coordonnées monde' },
        { id: 'model-camera-target', label: 'Regarde vers X/Y/Z', value: camera ? vector(camera.target) : 'Non mesuré', provenance: 'Cible reconstruite depuis la direction de vue' },
        { id: 'model-camera-projection', label: 'Projection', value: camera ? `FOV ${number(camera.fov, 1)}° · plans ${number(camera.near, 2)}–${number(camera.far, 0)}` : 'Non mesuré', provenance: 'Champ de vision vertical ; plan proche–lointain' },
        { id: 'model-camera-mode', label: 'Navigation', value: config.camera === 'orbit' ? 'Orbite' : 'Libre', provenance: config.camera === 'orbit' ? 'Rotation, zoom et translation' : 'W/A/S/D, R/F et regard souris' },
      ]} />
    </>
  );
}
