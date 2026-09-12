import type { EmeraldConfig } from '../lab/emeraldCampaign.ts';
import { useEmeraldPanel } from './useEmeraldPanel.ts';
import { Select } from './ui/Select.tsx';
import { BENCH_ENGINES } from '../../15-virtualized-integration/implementation/engines.ts';

export function EmeraldLiveFields() {
  const { view, config, state } = useEmeraldPanel();
  if (!view) return null;
  const set = <K extends keyof EmeraldConfig>(key: K, value: EmeraldConfig[K]) => view.setConfig?.({ [key]: value });
  const liveLocked = view.status === 'loading';
  return (
    <>
      <p className="text-xs text-base-content/65">{state.running ? 'Réglages actifs pendant l’exploration.' : 'Ces réglages restent modifiables pendant l’exploration.'}</p>
      <Select id="emerald-camera" label="Caméra" help={config.camera === 'orbit' ? 'Glisser pour tourner, molette pour zoomer, clic droit pour translater.' : 'Cliquer dans la vue puis W/A/S/D pour avancer, R/F pour l’altitude, glisser pour regarder.'} value={config.camera} disabled={liveLocked} onChange={event => set('camera', event.target.value as EmeraldConfig['camera'])}>
        <option value="orbit">Orbite</option>
        <option value="free">Libre (marche / survol)</option>
      </Select>
      <Select id="emerald-poi" label="Point d’intérêt" help="Repositionne la caméra sans relancer le moteur." value={config.poi ?? ''} disabled={liveLocked} onChange={event => set('poi', (event.target.value || null) as EmeraldConfig['poi'])}>
        <option value="">Position courante</option>
        <option value="overview">Vue générale</option>
        <option value="street">Rue</option>
        <option value="ground">Sol</option>
        <option value="foliage">Végétation</option>
        <option value="detail">Gros plan</option>
      </Select>
      <Select id="emerald-diagnostic" label="Vue de diagnostic" help="Le coût des diagnostics est exclu des mesures officielles." value={config.diagnostic} disabled={liveLocked} onChange={event => set('diagnostic', event.target.value as EmeraldConfig['diagnostic'])}>
        <option value="beauty">Rendu texturé</option>
        <option value="wireframe">Triangles soumis</option>
        <option value="clusters">Clusters / meshlets</option>
        <option value="lod">Niveau de détail sélectionné</option>
        <option value="pages">Pages / résidence</option>
        <option value="visibility">Frustum rejeté / visible</option>
        <option value="screen-error">Erreur projetée</option>
      </Select>
      <Select id="emerald-engine" label="Moteur affiché" help="Un seul moteur à l’écran. Changeable pendant l’exploration." value={config.engine} disabled={liveLocked} onChange={event => set('engine', event.target.value as EmeraldConfig['engine'])}>
        {BENCH_ENGINES.map(engine => <option key={engine.id} value={engine.id}>{engine.comparable ? engine.label : `${engine.label} · hors verdict visuel`}</option>)}
      </Select>
    </>
  );
}
