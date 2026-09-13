import type { ModelConfig } from '../lab/modelCampaign.ts';
import { useModelPanel } from './useModelPanel.ts';
import { Select } from './ui/Select.tsx';
import { BENCH_ENGINES } from '../../15-virtualized-integration/implementation/engines.ts';

export function ModelLiveFields() {
  const { view, config, state } = useModelPanel();
  if (!view) return null;
  const set = <K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) => view.setConfig?.({ [key]: value });
  const liveLocked = view.status === 'loading';
  return (
    <>
      <p className="text-xs text-base-content/65">{state.running ? 'Réglages actifs pendant l’exploration.' : 'Ces réglages restent modifiables pendant l’exploration.'}</p>
      <Select id="model-camera" label="Caméra" help={config.camera === 'orbit' ? 'Glisser pour tourner, molette pour zoomer, clic droit pour translater.' : 'Cliquer dans la vue puis W/A/S/D pour avancer, R/F pour l’altitude, glisser pour regarder.'} value={config.camera} disabled={liveLocked} onChange={event => set('camera', event.target.value as ModelConfig['camera'])}>
        <option value="orbit">Orbite</option>
        <option value="free">Libre (marche / survol)</option>
      </Select>
      <Select id="model-diagnostic" label="Vue de diagnostic" help="Le coût des diagnostics est exclu des mesures officielles." value={config.diagnostic} disabled={liveLocked} onChange={event => set('diagnostic', event.target.value as ModelConfig['diagnostic'])}>
        <option value="beauty">Rendu texturé</option>
        <option value="wireframe">Triangles soumis</option>
        <option value="clusters">Clusters / meshlets</option>
        <option value="lod">Niveau de détail sélectionné</option>
        <option value="pages">Pages / résidence</option>
        <option value="visibility">Frustum rejeté / visible</option>
        <option value="screen-error">Erreur projetée</option>
      </Select>
      <Select id="model-engine" label="Moteur affiché" help="Le moteur précédent est libéré, puis le nouveau démarre sur son canvas isolé." value={config.engine} disabled={liveLocked} onChange={event => view.selectEngine(event.target.value as ModelConfig['engine'])}>
        {BENCH_ENGINES.map(engine => <option key={engine.id} value={engine.id}>{engine.label}</option>)}
      </Select>
    </>
  );
}
