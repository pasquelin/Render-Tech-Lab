import type { ModelConfig } from '../lab/modelCampaign.ts';
import { useModelPanel } from './useModelPanel.ts';
import { Select } from './ui/Select.tsx';
import { BENCH_ENGINES } from '../../15-virtualized-integration/implementation/engines.ts';
import { LAB_CAMERA_MODES, cameraModeHelp } from '../lab/cameraModes.ts';

export function ModelLiveFields() {
  const { view, config, state } = useModelPanel();
  if (!view) return null;
  const set = <K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) => view.setConfig?.({ [key]: value });
  const liveLocked = view.status === 'loading';
  return (
    <>
      <p className="text-xs text-base-content/65">{state.running ? 'Réglages actifs pendant l’exploration.' : 'Ces réglages restent modifiables pendant l’exploration.'}</p>
      <Select id="model-camera" label="Caméra" help={cameraModeHelp(config.camera)} value={config.camera} disabled={liveLocked} onChange={event => set('camera', event.target.value as ModelConfig['camera'])}>
        {LAB_CAMERA_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
      </Select>
      {config.camera !== 'orbit' ? <Select id="model-city" label="Ville de départ" help="Repositionne la caméra sur un point libre de la copie choisie." value={config.startCity??0} disabled={liveLocked} onChange={event => set('startCity',Number(event.target.value))}>
        {Array.from({length:config.cities},(_,index)=><option key={index} value={index}>Ville {index+1}</option>)}
      </Select> : null}
      <Select id="model-diagnostic" label="Vue de diagnostic" help="Le coût des diagnostics est exclu des mesures officielles." value={config.diagnostic} disabled={liveLocked} onChange={event => set('diagnostic', event.target.value as ModelConfig['diagnostic'])}>
        <option value="beauty">Rendu texturé</option>
        <option value="wireframe">Triangles soumis</option>
        <option value="clusters">Clusters / meshlets</option>
        <option value="lod">Niveau de détail sélectionné</option>
        <option value="pages">Pages / résidence</option>
        <option value="visibility">Pages visibles (frustum)</option>
        <option value="screen-error">Erreur projetée / seuil</option>
      </Select>
      <Select id="model-engine" label="Moteur affiché" help="Le moteur précédent est libéré, puis le nouveau démarre sur son canvas isolé." value={config.engine} disabled={liveLocked} onChange={event => view.selectEngine(event.target.value as ModelConfig['engine'])}>
        {BENCH_ENGINES.map(engine => <option key={engine.id} value={engine.id}>{engine.label}</option>)}
      </Select>
    </>
  );
}
