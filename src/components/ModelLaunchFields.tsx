import { INTEGRATION_SCENE_OPTIONS, type IntegrationScene } from '../lab/modelView.ts';
import type { ModelConfig } from '../lab/modelCampaign.ts';
import { useModelPanel } from './useModelPanel.ts';
import { Select } from './ui/Select.tsx';
import { RadioBoard } from './ui/RadioBoard.tsx';
import { LOD_QUALITY } from '@web-geometry/sdk';
import { benchmarkModels } from '../../15-virtualized-integration/index.ts';
import { defaultModelId } from '../lab/modelAvailability.ts';
import { BENCH_ENGINES } from '../../15-virtualized-integration/implementation/engines.ts';

export function ModelLaunchFields() {
  const { view, config, onIntegrationScene, state } = useModelPanel();
  if (!view) return null;
  const set = <K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) => view.setConfig?.({ [key]: value });
  const frozen = state.running;
  return (
    <section aria-label="Configuration de lancement" className="space-y-4 min-w-0">
      <h2 className="text-lg font-semibold">Configuration de lancement</h2>
      <RadioBoard
        id="model-scene"
        label="Scène du banc 15"
        value="model"
        disabled={frozen}
        onChange={value => onIntegrationScene?.(value as IntegrationScene)}
        options={INTEGRATION_SCENE_OPTIONS}
      />
      <RadioBoard
        id="bench15-model"
        label="Modèle"
        help="Chaque modèle utilise son cache complet préparé."
        value={config.modelId || defaultModelId()}
        columns={4}
        disabled={frozen}
        onChange={value => set('modelId', value)}
        options={benchmarkModels.map(model => ({ value: model.id, title: model.label, detail: 'Cache complet' }))}
      />
      <RadioBoard
        id="model-mode"
        label="Que voulez-vous faire ?"
        value={config.mode}
        disabled={frozen}
        onChange={value => set('mode', value)}
        options={[
          { value: 'explore', title: 'Exploration libre', detail: 'Explorer le modèle. Caméra, diagnostic et moteur à droite.' },
          { value: 'path', title: 'Parcours reproductible (4 moteurs)', detail: 'THREE.js basic → THREE.js LOD → WebGeometry WebGL → WebGeometry WebGPU. Une photo par segment.' },
        ]}
      />
      {config.mode === 'explore' && (
        <RadioBoard
          id="model-start-engine"
          label="Moteur au démarrage"
          help="Appliqué dès le premier lancement libre. Chaque moteur utilise son canvas isolé."
          value={config.engine}
          columns={4}
          disabled={frozen}
          onChange={value => set('engine', value as ModelConfig['engine'])}
          options={BENCH_ENGINES.map(engine => ({ value: engine.id, title: engine.label, detail: engine.id }))}
        />
      )}
    </section>
  );
}

/** Shared preparation controls, rendered in the sidebar before a scene starts. */
export function ModelPreparationFields() {
  const { view, config, state } = useModelPanel();
  if (!view) return null;
  const set = <K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) => view.setConfig?.({ [key]: value });
  const frozen = state.running;
  return (
    <div className="space-y-4 min-w-0">
      <Select id="model-debug" label="Mode debug" help="Journal détaillé par image, chargements et décisions. Son coût affecte les temps observés." value={config.debug ? 'trace' : 'summary'} disabled={frozen} onChange={event => set('debug', event.target.value === 'trace')}>
        <option value="trace">Actif — journal détaillé</option>
        <option value="summary">Désactivé — journal résumé</option>
      </Select>
      <RadioBoard
        id="model-extent"
        label="Étendue"
        help="Les copies partagent géométries et textures. Les statistiques multiplient les instances."
        value={config.cities}
        columns={4}
        disabled={frozen}
        onChange={value => set('cities', value)}
        options={[
          { value: 1, title: '1 modèle', detail: 'Une instance source.' },
          { value: 4, title: '4 modèles', detail: 'Grille 2 × 2.' },
          { value: 9, title: '9 modèles', detail: 'Grille 3 × 3.' },
          { value: 12, title: '12 modèles', detail: 'Grille 4 × 3.' },
        ]}
      />
      <RadioBoard
        id="model-detail"
        label="Niveau de détail"
        help="Chaque choix change le seuil pixelError du runtime."
        value={config.lodQuality}
        columns={2}
        disabled={frozen}
        onChange={value => set('lodQuality', value)}
        options={[
          { value: 'source', title: LOD_QUALITY.source.label, detail: 'Feuilles exactes, aucune simplification.' },
          { value: 'high', title: LOD_QUALITY.high.label, detail: 'Seuil 1 px.' },
          { value: 'balanced', title: LOD_QUALITY.balanced.label, detail: 'Seuil 4 px.' },
          { value: 'adaptive', title: LOD_QUALITY.adaptive.label, detail: 'Le seuil monte avec la vitesse caméra.' },
        ]}
      />
      <RadioBoard
        id="model-anisotropy"
        label="Textures"
        help="Sans réduction de résolution cachée."
        value={config.detail}
        disabled={frozen}
        onChange={value => set('detail', value)}
        options={[
          { value: 'source', title: 'Filtrage source', detail: 'Anisotropie du fichier.' },
          { value: 'maximum', title: 'Anisotropie maximale', detail: 'Maximum disponible du GPU.' },
        ]}
      />
    </div>
  );
}
