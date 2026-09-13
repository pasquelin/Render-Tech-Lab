import { useModelPanel } from './useModelPanel.ts';
import { Button } from './ui/Button.tsx';
import { benchEngine } from '../../15-virtualized-integration/implementation/engines.ts';

export function ModelRunBody() {
  const { view, state, actions } = useModelPanel();
  if (!view) return null;
  return (
    <>
      <Button disabled={!state.running && view.availability.status !== 'ready'} onClick={state.running ? view.stop : actions.runBenchmark}>{state.running ? 'Arrêter l’exploration' : state.benchLabel}</Button>
      <p className="text-xs text-base-content/65">{view.config.mode === 'path' ? 'Quatre moteurs sont lancés sur le même trajet : THREE.js basic, THREE.js LOD, WebGeometry WebGL, puis WebGeometry WebGPU. Une photo et ses infos techniques sont prises à chaque segment. Pas un verdict de performance.' : `Moteur affiché : ${benchEngine(view.config.engine).label}. Le sélecteur de moteur sert à l’exploration libre.`}</p>
    </>
  );
}
