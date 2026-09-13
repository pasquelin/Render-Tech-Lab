import { useEmeraldPanel } from './useEmeraldPanel.ts';
import { Button } from './ui/Button.tsx';

export function EmeraldRunBody() {
  const { view, state, actions } = useEmeraldPanel();
  if (!view) return null;
  return (
    <>
      <Button disabled={!state.running && view.availability.status !== 'ready'} onClick={state.running ? view.stop : actions.runBenchmark}>{state.running ? 'Arrêter l’exploration' : state.benchLabel}</Button>
      <p className="text-xs text-base-content/65">{view.config.mode === 'path' ? 'Un lancement enchaîne Three.js, les pages WebGL2 et le raster WebGPU sur le même trajet. Une photo et ses infos techniques sont prises à chaque segment. Pas un verdict de performance.' : `Moteur affiché : ${view.config.engine}. Le sélecteur de moteur sert à l’exploration libre.`}</p>
    </>
  );
}
