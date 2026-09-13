import { idleExecution, type ExecutionState, type LabProgress } from './execution.ts';
import { MODULE_DESCRIPTORS } from './modules.ts';
import { moduleUi } from './moduleUi.ts';

export type LabMode = 'classic' | 'gpu-driven';

export type LabMetric = {
  label: string;
  val: string;
  desc?: string;
};

export type LabStats = {
  objects: string;
  submit: string;
  cpuFrame: string;
  fps: string;
  drawCalls: string;
  modeLabel: string;
};

export type WorkbenchState = {
  visible: boolean;
  title: string;
  desc: string;
  badge: string;
  idLabel: string;
  principle: string;
  schemaHtml: string;
  metrics: LabMetric[];
  reportHtml: string;
  reportPath: string;
  terminal: string;
  terminalBusy: boolean;
  terminalDuration: string;
};

export type ReportModalState = {
  open: boolean;
  title: string;
  path: string;
  html: string;
  raw: string;
  feedback: string;
};

export type ScenarioOption = {
  val: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
};

export type LabSnapshot = {
  execution: ExecutionState;
  moduleId: string;
  mode: LabMode;
  scenarioVal: string;
  stats: LabStats;
  benchStatus: string;
  benchTone: string;
  reportHint: string;
  telemetryMode: string;
  telemetryDetail: string;
  workbench: WorkbenchState;
  showBaseline: boolean;
  showWebgl: boolean;
  showWebgpu: boolean;
  showChart: boolean;
  showLodComparison: boolean;
  showPain: boolean;
  hideOpenWorldLinks: boolean;
  benchLabel: string;
  painLabel: string;
  scenarioOptions: ScenarioOption[];
  running: boolean;
  framePresented: boolean;
  progress: LabProgress | null;
  reportModal: ReportModalState;
  classicActive: boolean;
  countLabel: string;
  modeHint: string;
  runCardTitle: string;
};

export function emptyWorkbench(): WorkbenchState {
  return {
    visible: false,
    title: '',
    desc: '',
    badge: '',
    idLabel: '',
    principle: '',
    schemaHtml: '',
    metrics: [],
    reportHtml: '',
    reportPath: '',
    terminal: 'Prêt. Modifiez la charge dans le panneau de droite ou cliquez sur « Benchmark » pour exécuter le banc.',
    terminalBusy: false,
    terminalDuration: '',
  };
}

export function emptyModal(): ReportModalState {
  return {
    open: false,
    title: 'Rapport R&D — REPORT.md',
    path: 'reports/01-indirect-draw/campaign-<id>/',
    html: '',
    raw: '',
    feedback: '',
  };
}

export function initialSnapshot(moduleId = '00-baseline'): LabSnapshot {
  const desc = MODULE_DESCRIPTORS[moduleId] ?? MODULE_DESCRIPTORS['00-baseline'];
  const ui = moduleUi(moduleId);
  return {
    moduleId,
    execution: idleExecution(),
    mode: 'gpu-driven',
    scenarioVal: desc.options.find((option) => option.selected)?.val ?? desc.options[0]?.val ?? '',
    stats: {
      objects: desc.stats.objects,
      submit: '-- ms',
      cpuFrame: '-- ms',
      fps: '-- FPS',
      drawCalls: '--',
      modeLabel: 'Test B (GPU-Driven)',
    },
    benchStatus: 'Prêt pour la campagne de mesure.',
    benchTone: 'text-base-content/80',
    reportHint: `reports/${moduleId}/campaign-<id>/`,
    telemetryMode: desc.telemetryMode,
    telemetryDetail: desc.telemetryDetail,
    workbench: emptyWorkbench(),
    showBaseline: moduleId === '00-baseline',
    showWebgl: false,
    showWebgpu: false,
    showChart: false,
    showLodComparison: Boolean(ui.comparisonHref),
    showPain: Boolean(desc.painLabel),
    hideOpenWorldLinks: false,
    benchLabel: desc.benchLabel,
    painLabel: desc.painLabel ?? 'Tests de Douleur (10k → 100k)',
    scenarioOptions: desc.options.map((option) => ({
      val: option.val,
      label: option.label,
      selected: Boolean(option.selected),
      disabled: option.disabled,
    })),
    running: false,
    framePresented: false,
    progress: null,
    reportModal: emptyModal(),
    classicActive: false,
    countLabel: ui.countLabel,
    modeHint: ui.modeHint,
    runCardTitle: '3. Courbe de Croisement & Douleur',
  };
}

export type LabActions = {
  newExecution?: () => void;
  stopBenchmark?: () => void;
  switchModule: (moduleId: string) => void;
  setMode: (mode: LabMode) => void;
  setScenario: (value: string) => void;
  runBenchmark: () => void;
  runPain: () => void;
  openReport: (testId?: string) => void;
  closeReport: () => void;
  copyReport: () => void;
  refreshReport: () => void;
  openFinder: () => void;
};
