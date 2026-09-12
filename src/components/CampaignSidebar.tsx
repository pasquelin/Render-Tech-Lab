import { Square } from 'lucide-react';
import { CampaignResult } from './PreparationStation.tsx';
import { useLab } from './LabContext.tsx';
import { executionStep, executionSteps } from '../lab/execution.ts';
import { moduleUi } from '../lab/moduleUi.ts';
import { Button } from './ui/Button.tsx';

export function CampaignSidebar() {
  const { state, actions } = useLab();
  const execution = state.execution;
  if (state.moduleId === '00-baseline' || execution.status === 'idle') return null;
  const labels = { running: 'Test en cours', completed: 'Campagne terminée', stopped: 'Arrêt manuel', error: 'Exécution interrompue' };
  const step = executionStep(execution);
  const nativeStop = moduleUi(state.moduleId).holdSurfaces;
  return (
    <section data-campaign-sidebar={execution.status} className="min-w-0 space-y-3 break-words [overflow-wrap:anywhere]">
      <h2 className="text-xs font-mono text-primary">{labels[execution.status]}</h2>
      <ol className="flex flex-wrap gap-2 text-[11px]" aria-label="Étapes de la campagne">
        {executionSteps.map((label, index) => (
          <li key={label} aria-current={step === index ? 'step' : undefined} className={step === index ? 'text-primary font-bold' : 'text-base-content/60'}>{label}</li>
        ))}
      </ol>
      <p role="status" className="text-xs leading-relaxed">{execution.phase || state.benchStatus}</p>
      {state.running ? (
        !nativeStop && actions.stopBenchmark ? (
          <Button id="btn-stop-campaign" variant="danger" className="w-full gap-1.5" onClick={actions.stopBenchmark}>
            <Square className="w-3 h-3" />Arrêter
          </Button>
        ) : null
      ) : (
        <>
          {execution.status === 'stopped' ? <p className="text-xs">Les dernières mesures complètes sont conservées. La campagne interrompue n’est pas une comparaison complète.</p> : null}
          <CampaignResult summary={execution.lastCampaign} />
          {state.workbench.visible ? <details className="text-xs"><summary>Journal du banc</summary><pre className="whitespace-pre-wrap break-words py-3">{state.workbench.terminal}</pre></details> : null}
        </>
      )}
    </section>
  );
}
