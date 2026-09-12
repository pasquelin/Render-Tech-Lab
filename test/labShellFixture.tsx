// Browser-only layout fixture. Values are synthetic test inputs, never archived results.
import { createRoot } from 'react-dom/client';
import { LabShell } from '../src/components/LabShell.tsx';
import { LabContext } from '../src/components/LabContext.tsx';
import { initialSnapshot } from '../src/lab/labState.ts';
import '../src/style.css';
const state = initialSnapshot('01-indirect-draw');
state.showWebgpu = true; state.showBaseline = false;
const fixtureStatus = new URLSearchParams(location.search).get('state') === 'running' ? 'running' : 'completed';
state.execution = { status: fixtureStatus, phase: fixtureStatus === 'running' ? 'Préparation des surfaces du banc.' : 'Campagne terminée. ' + 'Détails de la dernière campagne à conserver intégralement. '.repeat(6), lastCampaign: {
  timestamp: '2026-09-12T09:00:00Z', status: 'Fixture de test', configuration: '1920 × 1080 · test de mise en page',
  series: ['A · Référence', 'B · Étiquette très longue de la variante candidate avec détails'].map(label => ({ label, values: [1, 2, 3], unit: 'ms (fixture)' })) } };
state.running = state.execution.status === 'running';
const noop = () => {};
createRoot(document.getElementById('root')!).render(<LabContext.Provider value={{ state, actions: { newExecution: noop, switchModule: noop, setMode: noop, setScenario: noop, runBenchmark: noop, stopBenchmark: noop, runPain: noop, openReport: noop, closeReport: noop, copyReport: noop, refreshReport: noop, openFinder: noop } }}><LabShell webglRef={{ current: null }} webgpuRef={{ current: null }} chartRef={{ current: null }} /></LabContext.Provider>);
