import { IntegrationFixtureLab } from './IntegrationFixtureLab.tsx';
import { EmeraldLab } from './EmeraldLab.tsx';
import type { IntegrationScene } from '../lab/emeraldView.ts';
import { useLayoutEffect, useRef, useState } from 'react';
import { parseMarkdownToHtml } from '../lab/markdown.ts';
import { LabSession } from '../lab/bootLab.ts';
import { initialSnapshot, type LabActions, type LabSnapshot } from '../lab/labState.ts';
import { navigateLabRoute } from '../lab/navigation.ts';
import { LabContext } from './LabContext.tsx';
import { LabShell } from './LabShell.tsx';

const idleActions: LabActions = {
  switchModule: navigateLabRoute, setMode: () => undefined, setScenario: () => undefined,
  runBenchmark: () => undefined, stopBenchmark: () => undefined, runPain: () => undefined,
  openReport: () => undefined, closeReport: () => undefined, copyReport: () => undefined,
  refreshReport: () => undefined, openFinder: () => undefined,
};

export function UnifiedLab({ test, native }: { test: string; native: boolean }) {
  return test === '15-virtualized-integration' ? <IntegrationLab /> : <StandardLab test={test} native={native} />;
}
function IntegrationLab() {
  const [scene, setScene] = useState<IntegrationScene>('emerald');
  return scene === 'emerald' ? <EmeraldLab onScene={setScene}/> : <IntegrationFixtureLab onScene={setScene}/>;
}
function StandardLab({ test, native, onScene }: { test: string; native: boolean; onScene?: (scene: IntegrationScene) => void }) {
  const webglRef = useRef<HTMLCanvasElement>(null);
  const webgpuRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<LabSnapshot>(() => initialSnapshot(test));
  const [actions, setActions] = useState<LabActions>(() => idleActions);

  useLayoutEffect(() => {
    document.title = `${test === '00-baseline' ? 'Dashboard' : test} — render-tech-lab`;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const patch = (value: Partial<LabSnapshot>) => { if (!cancelled) setState(previous => ({ ...previous, ...value })); };
    setActions(idleActions);
    void (async () => {
      if (test === '00-baseline') {
        setState(initialSnapshot('00-baseline'));
        setActions({ ...idleActions, openReport: async () => {
          patch({ reportModal: { ...initialSnapshot('00-baseline').reportModal, open: true, title: 'Rapport de référence — Dashboard', path: 'reports/00-baseline.md', html: '<p>Chargement du rapport…</p>' } });
          try { const response = await fetch('/api/get-report?testId=00-baseline'); const text = await response.text(); patch({ reportModal: { ...initialSnapshot('00-baseline').reportModal, open: true, title: 'Rapport de référence — Dashboard', path: 'reports/00-baseline.md', raw: text, html: response.ok ? parseMarkdownToHtml(text) : `<p>${text}</p>` } }); } catch { /* visible loading state remains */ }
        }, closeReport: () => patch({ reportModal: { ...initialSnapshot('00-baseline').reportModal, open: false } }) });
        return;
      }
      if (!native) {
        setState(initialSnapshot(test));
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (cancelled) return;
        const session = new LabSession({
          get webgl() { return webglRef.current; },
          get webgpu() { return webgpuRef.current; },
          get chart() { return chartRef.current; },
        });
        const unsubscribe = session.subscribe(setState);
        dispose = () => { unsubscribe(); session.dispose(); };
        setActions({...session.actions,switchModule:id=>{if(id==='15-virtualized-integration'||test==='15-virtualized-integration')navigateLabRoute(id);else session.actions.switchModule(id);}});
        await session.start();
        return;
      }
      const initial = initialSnapshot(test);
      const worldOptions = ['1', '9', '25'].map(value => ({ val: value, label: `${value} quartier${value === '1' ? '' : 's'}`, selected: value === '9' }));
      patch({ ...initial, moduleId: test, showBaseline: false, showWebgl: test === '14-open-world', showWebgpu: test === '04-gpu-lod', showChart: test === '04-gpu-lod', showPain: true, running: true,
        execution: { status: 'running', phase: 'Initialisation du banc…', lastCampaign: null },
        ...(test === '14-open-world' ? { scenarioVal: '9', scenarioOptions: worldOptions, stats: { ...initial.stats, objects: '9 quartiers' } } : {}) });
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (cancelled) return;
      if (test === '14-open-world') {
        const { mountWorldWorkbench } = await import('../../14-open-world/implementation/worldPage.ts');
        const controller = mountWorldWorkbench(patch);
        if (cancelled) return controller.dispose();
        dispose = controller.dispose;
        const reset = () => patch({ running: false, execution: { status: 'idle', phase: '', lastCampaign: null } });
        setActions({ ...idleActions, newExecution: reset, setMode: controller.setMode, setScenario: controller.setScenario, runBenchmark: controller.run, runPain: controller.stop, stopBenchmark: controller.stop, openReport: controller.report });
      } else {
        const { mountNativeLodWorkbench } = await import('../../04-gpu-lod/runner/nativePage.ts');
        const controller = mountNativeLodWorkbench(parseMarkdownToHtml, patch);
        if (cancelled) return controller.dispose();
        dispose = controller.dispose;
        const reset = () => patch({ running: false, execution: { status: 'idle', phase: '', lastCampaign: null } });
        setActions({ ...idleActions, newExecution: reset, setMode: controller.setMode, setScenario: controller.setScenario, runBenchmark: controller.run, runPain: controller.stop, stopBenchmark: controller.stop, openReport: controller.report });
      }
      patch({ running: false, execution: { status: 'idle', phase: '', lastCampaign: null } });
    })();
    return () => { cancelled = true; dispose?.(); };
  }, [test, native]);

  return <LabContext.Provider value={{ state, actions, onIntegrationScene: onScene }}><LabShell key={test} webglRef={webglRef} webgpuRef={webgpuRef} chartRef={chartRef} /></LabContext.Provider>;
}
