import { INTEGRATION_SCENE_OPTIONS, type IntegrationScene } from '../lab/modelView.ts';
import type { ModelConfig } from '../lab/modelCampaign.ts';
import { useModelPanel } from './useModelPanel.ts';
import { Select } from './ui/Select.tsx';
import { Input } from './ui/Input.tsx';
import { RadioBoard } from './ui/RadioBoard.tsx';
import { campaignFolderName } from '../../shared/campaign/truthReport.ts';
import { LOD_QUALITY } from '@web-geometry/sdk';
import { benchmarkModels } from '../../15-virtualized-integration/index.ts';
import { defaultModelId } from '../lab/modelAvailability.ts';
import { BENCH_ENGINES } from '../../15-virtualized-integration/implementation/engines.ts';

/** Message d'erreur du champ « Nom de campagne », tiré de la règle de nommage des archives. */
function campaignNameError(name: string) {
  try { campaignFolderName(name); return undefined; }
  catch (error) { return error instanceof Error ? error.message : String(error); }
}

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
      {config.mode === 'path' && (
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <Input id="model-measure-width" label="Largeur de mesure (px CSS)" type="number" min={320} step={1} value={config.measureWidth} disabled={frozen} onChange={event => set('measureWidth', Number(event.target.value))} />
            <Input id="model-measure-height" label="Hauteur de mesure (px CSS)" type="number" min={240} step={1} value={config.measureHeight} disabled={frozen} onChange={event => set('measureHeight', Number(event.target.value))} />
          </div>
          <Select id="model-pixel-ratio" label="Pixels physiques par pixel CSS" help="Le canvas physique mesure la résolution CSS multipliée par ce facteur." value={config.pixelRatio} disabled={frozen} onChange={event => set('pixelRatio', Number(event.target.value))}>
            <option value={1}>DPR 1</option>
            <option value={2}>DPR 2</option>
          </Select>
          <Select id="model-engine-order" label="Sens des moteurs" help="Un bloc complet enchaîne le sens direct puis le sens inverse ; les deux passes sont conservées." value={config.engineOrder} disabled={frozen} onChange={event => set('engineOrder', event.target.value as ModelConfig['engineOrder'])}>
            <option value="direct">Aller · ordre du protocole</option>
            <option value="reverse">Retour · ordre inversé</option>
          </Select>
          <Input
            id="model-campaign-name"
            label="Nom de campagne"
            help="Dossier d'archive sous reports/15-virtualized-integration/. Lettres, chiffres et tirets ; le préfixe « campaign- » est réservé à la rétention à deux campagnes."
            error={campaignNameError(config.campaignName)}
            value={config.campaignName}
            disabled={frozen}
            onChange={event => set('campaignName', event.target.value.replace(/[^A-Za-z0-9-]/g, '-'))}
          />
        </div>
      )}
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
