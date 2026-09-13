import { INTEGRATION_SCENE_OPTIONS, type IntegrationScene } from '../lab/emeraldView.ts';
import type { EmeraldConfig } from '../lab/emeraldCampaign.ts';
import { useEmeraldPanel } from './useEmeraldPanel.ts';
import { RadioBoard } from './ui/RadioBoard.tsx';
import { LOD_QUALITY } from '@web-geometry/sdk';
import { benchmarkModels } from '../../15-virtualized-integration/index.ts';

export function EmeraldLaunchFields() {
  const { view, config, onIntegrationScene, state } = useEmeraldPanel();
  if (!view) return null;
  const set = <K extends keyof EmeraldConfig>(key: K, value: EmeraldConfig[K]) => view.setConfig?.({ [key]: value });
  const frozen = state.running;
  return (
    <section aria-label="Configuration de lancement" className="space-y-4 min-w-0">
      <h2 className="text-lg font-semibold">Configuration de lancement</h2>
      <RadioBoard
        id="emerald-scene"
        label="Scène du banc 15"
        value="emerald"
        disabled={frozen}
        onChange={value => onIntegrationScene?.(value as IntegrationScene)}
        options={INTEGRATION_SCENE_OPTIONS}
      />
      <RadioBoard
        id="bench15-model"
        label="Modèle"
        help="Chaque modèle utilise son cache complet préparé."
        value={config.modelId ?? 'emerald-square'}
        columns={4}
        disabled={frozen}
        onChange={value => set('modelId', value)}
        options={benchmarkModels.map(model => ({ value: model.id, title: model.label, detail: 'Cache complet' }))}
      />
      <RadioBoard
        id="emerald-mode"
        label="Que voulez-vous faire ?"
        value={config.mode}
        disabled={frozen}
        onChange={value => set('mode', value)}
        options={[
          { value: 'explore', title: 'Exploration libre', detail: 'Explorer le modèle. Caméra, diagnostic et moteur à droite.' },
          { value: 'path', title: 'Parcours reproductible', detail: 'Test auto : Three.js, pages WebGL2 et raster WebGPU, une photo par segment.' },
        ]}
      />
      <RadioBoard
        id="emerald-extent"
        label="Étendue"
        help="Les copies partagent géométries et textures. Les statistiques multiplient les instances."
        value={config.cities}
        columns={3}
        disabled={frozen}
        onChange={value => set('cities', value)}
        options={[
          { value: 1, title: '1 modèle', detail: 'Une instance source.' },
          { value: 4, title: '4 modèles', detail: 'Grille 2 × 2.' },
          { value: 9, title: '9 modèles', detail: 'Grille 3 × 3.' },
        ]}
      />
      <RadioBoard
        id="emerald-detail"
        label="Niveau de détail"
        help="Chaque choix change le seuil pixelError du runtime."
        value={config.lodQuality}
        columns={4}
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
        id="emerald-anisotropy"
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
    </section>
  );
}
