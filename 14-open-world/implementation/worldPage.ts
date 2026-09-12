import { createControlLock } from '../../src/lab/controlLock.ts';
import type { LabSnapshot } from '../../src/lab/labState.ts';
import { campaignSummary } from '../../src/lab/campaignSummary.ts';
import { runWorldComparison } from './worldScene.ts';
import type { WorldOptions, WorldPreviewMetrics } from '../contracts.ts';
import { formatWorldReport, worldRows, modeLabels, ms, type SavedWorldReport } from '../runner/reporter.ts';
import { createWorldMatrix, worldMatrixTotals, type WorldMatrixAxes } from '../scenarios/worldMatrix.ts';

interface Archive { timestamp: string; config: WorldOptions; jsonUrl: string; markdownUrl: string; sourcesUrl?: string | null; published?: boolean }
interface SystemSample {
  sampledAtMs: number; cpuTimes: { idle: number; total: number };
  freeMemoryBytes: number; totalMemoryBytes: number; cpuModel: string; logicalCpuCount: number;
}

/** Mount the world benchmark inside the laboratory's existing shell and controls. */
export function mountWorldWorkbench(onUpdate: (patch: Partial<LabSnapshot>) => void = () => {}) {
  let disposed = false;
  let execution: LabSnapshot['execution'] = { status: 'idle', phase: '', lastCampaign: null };
  const el = <T extends HTMLElement>(id: string): T => {
    const value = document.getElementById(id);
    if (!value) throw new Error(`Élément absent : ${id}`);
    return value as T;
  };
  const listen = new AbortController();
  const on = (node: HTMLElement | Window, event: string, handler: EventListener) => node.addEventListener(event, handler, { signal: listen.signal });
  const selected = (id: string) => el<HTMLSelectElement>(id).value;
  const checked = (id: string) => el<HTMLInputElement>(id).checked;
  const text = (id: string, value: string) => { el(id).textContent = value; };
  const status = (value: string) => {
    if (disposed) return;
    text('bench-status', value);
    execution = { ...execution, phase: value };
    const count = value.match(/(\d+)\/(\d+)/);
    const itemType = /texture/i.test(value) ? 'textures' : /shader/i.test(value) ? 'shaders' : /buffer/i.test(value) ? 'buffers' : /chargement|décor|bistro/i.test(value) ? 'modèles' : 'scène';
    onUpdate({ benchStatus: value, execution, progress: { phase: value, itemType, ...(count ? { completed: Number(count[1]), total: Number(count[2]) } : {}), message: value } });
  };
  const number = (value: number) => Number.isFinite(value) ? value.toLocaleString('fr-FR') : '—';
  const duration = (value?: number | null) => value != null && Number.isFinite(value) ? `${value.toFixed(1)} ms` : '— ms';
  const candidateButton = el<HTMLButtonElement>('btn-gpu-driven');
  const referenceButton = el<HTMLButtonElement>('btn-classic');
  const runButton = el<HTMLButtonElement>('btn-benchmark');
  const stopButton = el<HTMLButtonElement>('btn-pain-benchmark');
  const countSelect = el<HTMLSelectElement>('select-count');
  const moduleSelect = el<HTMLSelectElement>('select-module');
  const reportModal = el<HTMLDialogElement>('report-modal');
  let canvas = el<HTMLCanvasElement>('canvas-webgl');
  let active: AbortController | null = null;
  let stopSystemPolling: (() => void) | null = null;
  let pending: { report: SavedWorldReport; markdown: string } | null = null;
  let currentReport: SavedWorldReport | null = null;
  let currentMarkdown = '';
  let reportLinks: Archive | null = null;
  let historyRequest: AbortController | null = null;

  moduleSelect.value = '14-open-world';
  for (const option of moduleSelect.options) option.classList.toggle('active', option.selected);
  text('nav-module-title', '14 · Monde ouvert');
  document.title = '14 · Monde ouvert — Render Tech Lab';
  el('view-baseline').classList.add('hidden');
  el('viewport-workbench').classList.add('hidden');
  el('canvas-webgpu').style.display = 'none';
  canvas.style.display = '';
  canvas.style.objectFit = 'cover';
  text('viewport-telemetry-mode', 'Bistro · WebGL2');
  text('viewport-telemetry-detail', 'A ou B : afficher le décor · Mesurer : comparer');
  text('stat-mode', 'Aperçu arrêté');
  text('open-report-hint', '14-open-world/results/comparisons/ · COMPARISON.md');
  const reportLocation = el('lab-report-card').children[1];
  const reportFile = reportLocation.querySelector('code')!; reportFile.textContent = 'comparisons/ · COMPARISON.md';
  reportLocation.replaceChildren('Campagnes archivées : ', reportFile);
  referenceButton.textContent = 'A · Référence';
  candidateButton.textContent = 'B · Variante';
  runButton.textContent = 'Mesurer et comparer';
  stopButton.textContent = 'Arrêter';
  onUpdate({ benchLabel: 'Mesurer et comparer', painLabel: 'Arrêter', showChart: false,
    modeHint: 'Choisir la référence A ou la variante B avant la campagne :', runCardTitle: '3. Campagnes de comparaison' });
  stopButton.style.display = 'none';
  el('btn-lod-comparison').classList.add('hidden');
  el('canvas-chart').parentElement!.classList.add('hidden');
  el('lab-run-card').firstElementChild!.textContent = '3. Campagnes de comparaison';
  el('lab-mode-card').children[1].textContent = 'Aperçu de la référence ou de la variante, sur le même décor :';
  const countLabel = el('lab-mode-card').querySelector<HTMLLabelElement>('label[for="select-count"]');
  if (countLabel) countLabel.textContent = 'Étendue du décor :';
  const districtValues = [1, 9, 25] as const;
  const districtOptions = (selected = countSelect.value) => districtValues.map(value => ({ val: String(value), label: `${value} quartier${value > 1 ? 's' : ''}`, selected: String(value) === selected }));
  for (const id of ['stat-submit', 'stat-cpuframe', 'stat-fps', 'stat-drawcalls', 'stat-objects']) text(id, '—');
  el('stat-cpuframe').parentElement!.querySelector('.stat-desc')!.textContent = 'Caméra, calcul et soumission';
  el('stat-fps').parentElement!.querySelector('.stat-desc')!.textContent = '1 000 / intervalle moyen';
  const frequency = el('lab-metrics-card').firstElementChild!.querySelector('.badge');
  if (frequency) frequency.textContent = '500 ms';

  const controls = document.createElement('fieldset');
  controls.id = 'world-controls'; controls.className = 'space-y-3';
  const field = (id: string, labelText: string, values: Array<[string, string]>, initial: string) => {
    const label = document.createElement('label'); label.className = 'block text-xs text-base-content/70';
    label.append(labelText);
    const select = document.createElement('select'); select.id = id; select.className = `${countSelect.className} mt-1`;
    select.append(...values.map(([value, label]) => new Option(label, value, false, value === initial)));
    label.append(select); return label;
  };
  const check = (id: string, labelText: string, enabled = false) => {
    const label = document.createElement('label'); label.className = 'flex gap-2 items-center text-xs';
    const input = document.createElement('input'); input.id = id; input.type = 'checkbox'; input.className = 'checkbox checkbox-sm'; input.checked = enabled;
    label.append(input, labelText); return label;
  };
  const modeControls = document.createElement('fieldset'); modeControls.className = 'space-y-3';
  modeControls.append(field('world-candidate', 'Variante B', [['adaptive-coherent', 'Culling adaptatif · visibilité certifiée'], ['adaptive-frustum', 'Culling adaptatif · dernier plan rejetant'], ['shadow-cache', 'Ombres statiques réutilisées'], ['static-cache', 'Ombres et matrices réutilisées'], ['hierarchy', 'Contrôle : quartiers filtrés'], ['frustum', 'Contrôle : culling contre rendu brut']], 'adaptive-coherent'));
  el('lab-mode-card').append(modeControls);
  controls.append(
    field('world-resolution', 'Résolution physique', [['1920,1080,1', 'Full HD'], ['2560,1440,1', '1440p'], ['3840,2160,1', '4K'], ['1920,1080,2', 'Full HD · Retina ratio 2']], '1920,1080,1'),
    field('world-fov', 'Angle de vue', [['45', '45°'], ['60', '60°'], ['90', '90°']], '60'),
    field('world-path', 'Parcours', [['mixed', 'Mixte'], ['perimeter', 'Périmètre au sol'], ['panorama', 'Panorama']], 'mixed'),
    field('world-shadow-size', 'Définition des ombres', [['1024', '1 024 px'], ['2048', '2 048 px'], ['4096', '4 096 px']], '2048'),
    check('world-shadows', 'Ombres', true), check('world-wireframe', 'Afficher les triangles'), check('world-bounds', 'Afficher les limites'), check('world-antialias', 'Lissage des contours'),
    field('world-samples', 'Images mesurées par bloc', [['60', '60'], ['120', '120'], ['240', '240'], ['480', '480']], '120'),
    field('world-warmup', 'Images d’échauffement par bloc', [['30', '30'], ['60', '60'], ['120', '120']], '30'),
    field('world-repeats', 'Répétitions', [['1', '1'], ['2', '2'], ['3', '3']], '2'),
  );
  const matrix = document.createElement('details'); matrix.className = 'collapse collapse-arrow border border-base-content/10';
  const matrixTitle = document.createElement('summary'); matrixTitle.className = 'collapse-title p-3 text-xs font-semibold'; matrixTitle.textContent = 'Croiser les configurations';
  const matrixBody = document.createElement('div'); matrixBody.className = 'collapse-content space-y-2';
  matrixBody.append(check('world-matrix', 'Activer la matrice'));
  const matrixAxes: Array<[keyof WorldMatrixAxes, string]> = [
    ['districts', '1 + 9 + 25 quartiers'], ['resolutions', 'Full HD + 1440p + 4K'], ['retina', 'Ajouter Full HD · Retina ratio 2'],
    ['shadows', 'Avec et sans ombres'], ['methods', 'Les six comparaisons'], ['fov', 'Angles 45° + 60° + 90°'],
    ['antialias', 'Lissage activé et désactivé'], ['path', 'Les trois parcours'], ['shadowMapSize', 'Ombres 1 024 + 2 048 + 4 096 px'],
  ];
  for (const [key, label] of matrixAxes) matrixBody.append(check(`matrix-${key}`, label));
  matrix.append(matrixTitle, matrixBody); controls.append(matrix);
  const settings = document.createElement('details'); settings.className = 'collapse collapse-arrow border border-base-content/10';
  const settingsTitle = document.createElement('summary'); settingsTitle.className = 'collapse-title p-3 text-xs font-semibold'; settingsTitle.textContent = 'Réglages du rendu et de la campagne';
  const settingsBody = document.createElement('div'); settingsBody.className = 'collapse-content'; settingsBody.append(controls);
  settings.append(settingsTitle, settingsBody); runButton.parentElement!.before(settings);

  const instruments = document.createElement('div'); instruments.className = 'space-y-2 border-t border-base-content/10 pt-2';
  instruments.innerHTML = `<dl class="grid grid-cols-2 gap-x-2 gap-y-1 text-xs"><dt>Caméra et culling</dt><dd id="world-live-cull" class="font-mono text-right">— ms</dd><dt>GPU · dernier résultat</dt><dd id="world-live-gpu" class="font-mono text-right">Non mesuré</dd></dl><p class="text-[10px] text-base-content/60">Le résultat GPU arrive de façon asynchrone.</p><p id="world-metrics" class="text-[11px] font-mono leading-relaxed">Triangles du décor, triangles soumis et segments du filaire restent séparés.</p><div class="divider text-xs">Système</div><dl class="grid grid-cols-2 gap-x-2 gap-y-1 text-xs"><dt>CPU global</dt><dd id="world-system-cpu" class="font-mono text-right">—</dd><dt>RAM utilisée · estimation OS</dt><dd id="world-system-memory" class="font-mono text-right">—</dd></dl><p id="world-system-status" class="text-[10px] text-base-content/60">Relevés toutes les 2 s pendant l’aperçu ou les mesures.</p><p class="text-[10px] text-base-content/60">Charge, température et mémoire GPU : non mesurées.</p>`;
  el('lab-metrics-card').append(instruments);
  const plan = document.createElement('p'); plan.id = 'world-plan'; plan.className = 'text-[11px] text-base-content/70'; plan.setAttribute('aria-live', 'polite');
  el('bench-status').before(plan);
  const retryButton = document.createElement('button'); retryButton.type = 'button'; retryButton.className = 'btn btn-sm btn-lab-secondary w-full hidden'; retryButton.textContent = 'Réessayer la sauvegarde';
  runButton.parentElement!.append(retryButton);

  function options(): WorldOptions {
    const [width, height, pixelRatio] = selected('world-resolution').split(',').map(Number);
    return { width, height, pixelRatio, districts: Number(countSelect.value) as WorldOptions['districts'],
      samples: Number(selected('world-samples')), warmup: Number(selected('world-warmup')), shadows: checked('world-shadows'),
      fov: Number(selected('world-fov')), antialias: checked('world-antialias'), shadowMapSize: Number(selected('world-shadow-size')) as WorldOptions['shadowMapSize'],
      path: selected('world-path') as WorldOptions['path'], candidate: selected('world-candidate') as WorldOptions['candidate'],
      wireframe: checked('world-wireframe'), showBounds: checked('world-bounds') };
  }
  function campaigns() {
    const axes: WorldMatrixAxes = {};
    if (checked('world-matrix')) for (const [key] of matrixAxes) axes[key] = checked(`matrix-${key}`);
    return createWorldMatrix(options(), Number(selected('world-repeats')), axes);
  }
  function updatePlan() {
    const totals = worldMatrixTotals(campaigns());
    plan.textContent = `${number(totals.campaigns)} campagne(s) · ${number(totals.measuredFrames)} images mesurées + ${number(totals.warmupFrames)} d’échauffement + ${number(totals.controlFrames)} de contrôle. Ordres ABBA puis BAAB en alternance.`;
    text('stat-objects', `${countSelect.value} quartiers`);
    onUpdate({ scenarioVal: countSelect.value, scenarioOptions: districtOptions(), stats: { submit: el('stat-submit').textContent!, cpuFrame: el('stat-cpuframe').textContent!, fps: el('stat-fps').textContent!, drawCalls: el('stat-drawcalls').textContent!, objects: `${countSelect.value} quartiers`, modeLabel: el('stat-mode').textContent! } });
  }
  function setDistricts(value: string) {
    if (active || !districtValues.some(district => String(district) === value)) return;
    countSelect.value = value;
    updatePlan();
  }
  function stopSystemMonitor() { stopSystemPolling?.(); stopSystemPolling = null; }
  function startSystemMonitor() {
    stopSystemMonitor(); const controller = new AbortController();
    let previous: SystemSample | null = null, inFlight = false;
    text('world-system-cpu', 'Deux relevés nécessaires');
    const poll = async () => {
      if (inFlight || controller.signal.aborted || disposed) return;
      inFlight = true;
      try {
        const response = await fetch('/api/world-comparison/system', { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const sample = await response.json() as SystemSample;
        if (controller.signal.aborted || disposed) return;
        if (![sample.cpuTimes.total, sample.cpuTimes.idle, sample.totalMemoryBytes, sample.freeMemoryBytes].every(Number.isFinite) || sample.totalMemoryBytes <= 0) throw new Error('Relevé incomplet');
        if (previous) {
          const total = sample.cpuTimes.total - previous.cpuTimes.total, idle = sample.cpuTimes.idle - previous.cpuTimes.idle;
          text('world-system-cpu', total > 0 && idle >= 0 && idle <= total ? `${(100 * (total - idle) / total).toFixed(1)} %` : 'Non mesuré');
        }
        previous = sample;
        const gib = (bytes: number) => (bytes / 1024 ** 3).toFixed(1);
        text('world-system-memory', `${gib(sample.totalMemoryBytes - sample.freeMemoryBytes)} / ${gib(sample.totalMemoryBytes)} Gio`);
        text('world-system-status', `Dernier relevé OS : ${new Date(sample.sampledAtMs).toLocaleTimeString('fr-FR')} · ${sample.cpuModel} · ${sample.logicalCpuCount} processeurs logiques. RAM = total moins libre, caches inclus.`);
      } catch (error) { if (!controller.signal.aborted) text('world-system-status', `Relevé indisponible : ${String(error)}`); }
      finally { inFlight = false; }
    };
    const timer = window.setInterval(() => { void poll(); }, 2000);
    stopSystemPolling = () => { window.clearInterval(timer); controller.abort(); };
    void poll();
  }
  const lockControls = createControlLock(el('sidebar'));
  function busy(value: boolean) {
    if (disposed) return;
    lockControls(value);
    if (value) execution = { status: 'running', phase: 'Préparer', lastCampaign: null };
    else if (execution.status === 'running') execution = { ...execution, status: 'completed' };
    onUpdate({ running: value, ...(value ? { framePresented: false, progress: { phase: 'Préparer', itemType: 'modèles', message: 'Chargement du décor Bistro et de ses ressources.' } as const } : {}), execution });
    controls.disabled = modeControls.disabled = value; countSelect.disabled = value;
    referenceButton.disabled = candidateButton.disabled = runButton.disabled = value || pending !== null;
    stopButton.style.display = value ? '' : 'none';
    if (value) startSystemMonitor(); else stopSystemMonitor();
  }
  function stop() {
    execution = { ...execution, status: 'stopped' };
    if (!disposed) onUpdate({ execution });
    stopSystemMonitor(); active?.abort();
  }
  function freshCanvas() {
    // React owns this node and its ref. Replacing it makes later state patches
    // reconcile the detached canvas and leaves the running viewport blank.
    canvas.style.display = 'block'; canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.objectFit = 'cover';
  }
  let displayedBounds = 0;
  function metricText(metrics: WorldPreviewMetrics) {
    return `Décor : ${number(metrics.sourceTriangles)} triangles · ${number(metrics.sourceMeshes)} maillages. ` +
      `Triangles soumis : ${number(metrics.mainPassTriangles)} principaux · ${number(metrics.shadowPassTriangles)} d’ombres. ` +
      `Segments : ${number(metrics.mainPassLines)} principaux · ${number(metrics.shadowPassLines)} d’ombres. ` +
      `Dessins : ${number(metrics.mainPassDrawCalls)} principaux · ${number(metrics.shadowPassDrawCalls)} d’ombres. Limites actives : ${number(displayedBounds)}.`;
  }
  function metricHandler(measuringGpu = true) {
    let updated = performance.now(), intervalCount = 0, intervalTotal = 0;
    let lastGpuMs: number | null = null;
    return (metrics: WorldPreviewMetrics) => {
      if (disposed) return;
      onUpdate({ framePresented: true });
      const interval = metrics.rafDeltaMs;
      if (interval !== null && Number.isFinite(interval) && interval > 0) { intervalTotal += interval; intervalCount++; }
      if (metrics.gpuMs === null) lastGpuMs = null;
      else if (metrics.gpuMs !== undefined && Number.isFinite(metrics.gpuMs)) lastGpuMs = metrics.gpuMs;
      const now = performance.now(); if (now - updated < 500) return; updated = now;
      text('world-metrics', metricText(metrics));
      if(metrics.variant)text('stat-mode',`${modeLabels[metrics.variant]} · ${metrics.phase==='warmup'?'échauffement':metrics.phase==='measure'?'mesure':'aperçu'}`);
      text('stat-fps', intervalCount && intervalTotal > 0 ? `${(1000 * intervalCount / intervalTotal).toFixed(1)} FPS` : '— FPS');
      text('stat-cpuframe', duration(metrics.cpuFrameWorkMs)); text('stat-submit', duration(metrics.cpuRenderSubmitMs));
      text('stat-drawcalls', number(metrics.drawCalls)); text('world-live-cull', duration(metrics.cpuCullMs));
      text('world-live-gpu', !measuringGpu ? 'Non mesuré en aperçu' : lastGpuMs === null ? metrics.gpuTimerAvailable ? 'En attente' : 'Non mesuré' : duration(lastGpuMs));
      onUpdate({ stats: { submit: el('stat-submit').textContent!, cpuFrame: el('stat-cpuframe').textContent!, fps: el('stat-fps').textContent!, drawCalls: el('stat-drawcalls').textContent!, objects: el('stat-objects').textContent!, modeLabel: el('stat-mode').textContent! } });
      intervalCount = intervalTotal = 0;
    };
  }
  function describe(config: WorldOptions) {
    displayedBounds = config.showBounds ? config.districts : 0;
    text('viewport-telemetry-detail', `${config.districts} quartiers · ${config.width} × ${config.height} · ${config.wireframe ? 'filaire' : 'rendu'} · ombres ${config.shadows ? 'actives' : 'désactivées'}`);
  }
  function selectPreviewButton(candidate: boolean) {
    for (const [button, selected] of [[referenceButton, !candidate], [candidateButton, candidate]] as const) {
      button.classList.toggle('btn-lab-primary', selected);
      button.classList.toggle('btn-ghost', !selected);
      button.classList.toggle('text-base-content/70', !selected);
      button.classList.toggle('shadow-xs', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }
  function selectMode(candidate: boolean) {
    if (active) return;
    selectPreviewButton(candidate);
    const config = options();
    const variant = candidate ? config.candidate : config.candidate === 'frustum' ? 'brute' : 'frustum';
    text('stat-mode', modeLabels[variant]);
    onUpdate({ mode: candidate ? 'gpu-driven' : 'classic', classicActive: !candidate });
    status('Prêt · aucun décor ni moteur initialisé.');
  }
  const link = (label: string, href: string) => {
    const node = document.createElement('a'); node.textContent = label; node.href = href; node.className = 'link link-primary'; node.target = '_blank'; node.rel = 'noopener'; return node;
  };
  const comparisonBox = document.createElement('div'); comparisonBox.className = 'space-y-2 border-t border-base-content/10 pt-2';
  const comparisonTitle = document.createElement('p'); comparisonTitle.className = 'text-xs font-semibold'; comparisonTitle.textContent = 'Comparer deux rapports, y compris les rejets';
  comparisonBox.append(comparisonTitle); el('lab-report-card').append(comparisonBox);
  function comparisonSlot(id: string, label: string) {
    const control = field(id, label, [['', 'Choisir un rapport']], ''); comparisonBox.append(control);
    return { select: control.querySelector('select')!, archive: null as Archive | null, report: null as SavedWorldReport | null,
      error: null as string | null, loading: false, request: null as AbortController | null };
  }
  const compared = { a: comparisonSlot('world-report-a', 'Rapport A'), b: comparisonSlot('world-report-b', 'Rapport B') };
  const comparisonStatus = document.createElement('p'); comparisonStatus.className = 'text-[10px] text-base-content/60'; comparisonStatus.setAttribute('role', 'status');
  const comparisonTable = document.createElement('div'); comparisonTable.className = 'overflow-x-auto';
  comparisonBox.append(comparisonStatus, comparisonTable);
  let archiveEntries: Archive[] = [];
  const comparisonSides = ['a', 'b'] as const;
  function updateComparisonChoices(runs: Archive[]) {
    archiveEntries = runs;
    for (const side of comparisonSides) {
      const select = compared[side].select, previous = select.value;
      select.replaceChildren(new Option('Choisir un rapport', ''), ...runs.map(run => new Option(
        `${new Date(run.timestamp).toLocaleString('fr-FR')} · ${run.config.districts} quartiers · ${modeLabels[run.config.candidate] ?? run.config.candidate}`, run.jsonUrl,
      )));
      select.value = runs.some(run => run.jsonUrl === previous) ? previous : '';
    }
    comparisonStatus.textContent = runs.length ? 'Statistiques de la variante testée dans chaque rapport. Configurations différentes : aucune conclusion automatique.' : 'Aucune campagne enregistrée.';
  }
  async function refreshComparisonChoices() {
    try {
      const response = await fetch('/api/world-comparison/history', { signal: listen.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { runs } = await response.json() as { runs: Archive[] };
      if (!listen.signal.aborted) {
        updateComparisonChoices(runs);
        if (!currentReport && runs[0]) {
          const [jsonResponse, markdownResponse] = await Promise.all([
            fetch(runs[0].jsonUrl, { signal: listen.signal }),
            fetch(runs[0].markdownUrl, { signal: listen.signal }),
          ]);
          if (jsonResponse.ok && markdownResponse.ok && !listen.signal.aborted) {
            currentReport = await jsonResponse.json() as SavedWorldReport;
            currentMarkdown = await markdownResponse.text();
            reportLinks = runs[0];
          }
        }
      }
    } catch (error) { if (!listen.signal.aborted) comparisonStatus.textContent = `Historique indisponible : ${String(error)}`; }
  }
  function reportStatistics(report: SavedWorldReport) {
    const samples = report.blocks.filter(block => block.variant === report.config.candidate).flatMap(block => block.samples);
    const valid = (values: Array<number | null>) => values.filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
    const cpu = valid(samples.map(sample => sample.cpuFrameWorkMs)), raf = valid(samples.map(sample => sample.rafDeltaMs)), gpu = valid(samples.map(sample => sample.gpuMs));
    const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const quantile = (values: number[], fraction: number) => values.length ? [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)] : null;
    const interval = mean(raf);
    return { cpu: quantile(cpu, .5), rafP95: quantile(raf, .95), rafP99: quantile(raf, .99), cadence: interval !== null && interval > 0 ? 1000 / interval : null,
      gpu: quantile(gpu, .5), cpuSamples: cpu.length, rafSamples: raf.length, gpuSamples: gpu.length, frames: samples.length };
  }
  function renderComparison() {
    if (comparisonSides.every(side => !compared[side].select.value)) { comparisonTable.textContent = 'Choisir A et B pour afficher les données.'; return; }
    const table = document.createElement('table'); table.className = 'table table-zebra table-xs';
    const header = table.createTHead().insertRow();
    for (const label of ['Mesure', 'Rapport A', 'Rapport B']) { const th = document.createElement('th'); th.textContent = label; header.append(th); }
    const body = table.createTBody();
    const statistics = { a: compared.a.report ? reportStatistics(compared.a.report) : null, b: compared.b.report ? reportStatistics(compared.b.report) : null };
    const measuredDuration = (value: number | null) => value === null ? 'Non mesuré' : duration(value);
    const row = (label: string, value: (side: 'a' | 'b', report: SavedWorldReport) => string) => {
      const tr = body.insertRow(); tr.insertCell().textContent = label;
      for (const side of comparisonSides) {
        const slot = compared[side], cell = tr.insertCell(); cell.className = 'whitespace-normal break-words';
        cell.textContent = slot.loading ? 'Chargement…' : slot.error ?? (slot.report ? value(side, slot.report) : 'Non mesuré');
      }
    };
    row('Configuration', (_side, report) => {
      const c = report.config;
      return `${c.districts} quartiers · ${c.width} × ${c.height} · ratio ${c.pixelRatio} · ${c.path ?? 'mixed'} · ${c.fov ?? 60}° · ombres ${c.shadows ? c.shadowMapSize ?? 2048 : 'non'} · lissage ${c.antialias ? 'oui' : 'non'} · filaire ${c.wireframe ? 'oui' : 'non'} · limites ${c.showBounds ? 'oui' : 'non'} · ${c.samples} images / ${c.warmup} échauffement`;
    });
    row('Variante', (_side, report) => modeLabels[report.config.candidate] ?? report.config.candidate);
    row('Qualité', (_side, report) => report.quality?.passed === true ? 'Vues contrôlées identiques' : report.quality?.passed === false ? 'REJET' : 'Non renseignée');
    row('Erreur / réserve', (_side, report) => [report.quality?.failure, ...report.limitations.filter(value => value.startsWith('INVALID:'))].filter(Boolean).join(' · ') || (report.quality?.passed === false ? 'Contrôle refusé sans raison détaillée' : 'Aucune erreur enregistrée'));
    row('CPU p50', (side) => `${measuredDuration(statistics[side]!.cpu)} · ${statistics[side]!.cpuSamples}/${statistics[side]!.frames} images`);
    row('rAF p95 / p99', (side) => `${measuredDuration(statistics[side]!.rafP95)} / ${measuredDuration(statistics[side]!.rafP99)}`);
    row('Cadence · rAF', (side) => statistics[side]!.cadence === null ? 'Non mesurée' : `${statistics[side]!.cadence!.toFixed(2)} FPS · ${statistics[side]!.rafSamples} intervalles`);
    row('GPU p50', (side) => statistics[side]!.gpu === null ? 'Non mesuré' : `${duration(statistics[side]!.gpu)} · ${statistics[side]!.gpuSamples}/${statistics[side]!.frames} images`);
    const links = body.insertRow(); links.insertCell().textContent = 'Rapports';
    for (const side of comparisonSides) { const cell = links.insertCell(), archive = compared[side].archive; if (archive) cell.append(link('Données', archive.jsonUrl), ' · ', link('Markdown', archive.markdownUrl)); }
    comparisonTable.replaceChildren(table);
  }
  async function loadComparison(side: 'a' | 'b') {
    const slot = compared[side]; slot.request?.abort(); slot.request = null; slot.report = null; slot.error = null;
    slot.archive = archiveEntries.find(run => run.jsonUrl === slot.select.value) ?? null;
    if (!slot.archive) { slot.loading = false; renderComparison(); return; }
    const controller = new AbortController(); slot.request = controller; slot.loading = true; renderComparison();
    try {
      const response = await fetch(slot.archive.jsonUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`Lecture du rapport refusée (${response.status})`);
      const report = await response.json() as SavedWorldReport;
      if (controller.signal.aborted || disposed) return;
      if (report.test !== '14-open-world' || !report.config || !Array.isArray(report.blocks) || !Array.isArray(report.limitations)) throw new Error('Format de rapport non reconnu');
      slot.report = report;
    } catch (error) { if (!controller.signal.aborted) slot.error = String(error); }
    finally { if (!controller.signal.aborted) { slot.loading = false; renderComparison(); } }
  }
  for (const side of comparisonSides) on(compared[side].select, 'change', () => { void loadComparison(side); });
  renderComparison(); void refreshComparisonChoices();
  async function fillHistory(target: HTMLElement) {
    historyRequest?.abort(); const controller = new AbortController(); historyRequest = controller;
    try {
      const response = await fetch('/api/world-comparison/history', { signal: controller.signal });
      if (!response.ok) throw new Error(`Historique indisponible (${response.status})`);
      const { runs } = await response.json() as { runs: Archive[] };
      if (controller.signal.aborted || disposed) return;
      updateComparisonChoices(runs);
      target.replaceChildren();
      if (!runs.length) target.textContent = 'Aucune campagne enregistrée.';
      for (const run of runs) {
        const row = document.createElement('p'); row.className = 'py-2 border-b border-base-content/10 text-xs';
        row.append(`${new Date(run.timestamp).toLocaleString('fr-FR')} · ${run.config.districts} quartiers · ${run.config.width} × ${run.config.height} · ${modeLabels[run.config.candidate]} · `,
          link('Rapport', run.markdownUrl), ' · ', link('Données', run.jsonUrl));
        if (run.sourcesUrl) row.append(' · ', link('Sources', run.sourcesUrl));
        target.append(row);
      }
    } catch (error) { if (!controller.signal.aborted) target.textContent = String(error); }
  }
  function openReport() {
    text('modal-report-title', '14 · Rapports du monde ouvert'); text('modal-report-path', '14-open-world/results/comparisons/');
    const target = el('modal-report-body'); target.replaceChildren();
    if (currentReport) {
      const verdict = document.createElement('p'); verdict.className = currentReport.quality.passed ? 'text-success' : 'text-error';
      verdict.textContent = currentReport.quality.passed ? 'Vues de contrôle identiques. Comparer les répétitions avant de conclure à un gain.' : `Comparaison rejetée : ${currentReport.quality.failure ?? 'différence de pixels'}`;
      target.append(verdict);
      const wrapper = document.createElement('div'); wrapper.className = 'overflow-x-auto';
      const table = document.createElement('table'); table.className = 'table table-zebra table-sm';
      const head = table.createTHead().insertRow();
      for (const label of ['Mode', 'CPU p50', 'CPU p95', 'CPU p99', 'GPU p50', 'GPU mesurées', 'Intervalle p95', 'Intervalle p99', 'Cadence']) { const th = document.createElement('th'); th.textContent = label; head.append(th); }
      const body = table.createTBody();
      for (const row of worldRows(currentReport)) {
        const tr = body.insertRow();
        for (const value of [row.label, ...[row.cpu, row.cpuP95, row.cpuP99, row.gpu].map(ms), `${row.gpuSamples}/${row.frames}`, ...[row.rafP95, row.rafP99].map(ms), row.cadence?.toFixed(2) ?? 'Non mesurée']) tr.insertCell().textContent = value;
      }
      wrapper.append(table); target.append(wrapper);
      if (reportLinks) { const links = document.createElement('p'); links.append(link('Rapport archivé', reportLinks.markdownUrl), ' · ', link('Données brutes', reportLinks.jsonUrl)); if (reportLinks.sourcesUrl) links.append(' · ', link('Sources', reportLinks.sourcesUrl)); target.append(links); }
      const details = document.createElement('details'); const title = document.createElement('summary'); title.textContent = 'Lire le rapport complet'; const pre = document.createElement('pre'); pre.className = 'text-xs whitespace-pre-wrap select-text'; pre.textContent = currentMarkdown; details.append(title, pre); target.append(details);
    }
    const title = document.createElement('h2'); title.className = 'font-bold mt-4'; title.textContent = 'Campagnes conservées';
    const history = document.createElement('div'); history.textContent = 'Chargement…'; target.append(title, history);
    if (!reportModal.open) reportModal.showModal(); void fillHistory(history);
  }
  async function save(signal?: AbortSignal) {
    if (!pending) return;
    const response = await fetch('/api/world-comparison', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending), signal });
    if (signal?.aborted || disposed) return;
    if (!response.ok) throw new Error(`Sauvegarde refusée (${response.status}) : ${await response.text()}`);
    reportLinks = await response.json() as Archive; pending = null; retryButton.classList.add('hidden');
    if (reportModal.open) openReport();
    await refreshComparisonChoices();
  }
  async function run() {
    if (active || pending) return;
    const controller = new AbortController(); active = controller; busy(true); reportLinks = null;
    try {
      const planned = campaigns(); let completed = 0;
      for (const config of planned) {
        if (controller.signal.aborted) break;
        describe(config); freshCanvas(); text('stat-mode', `${modeLabels[config.candidate]} · ${config.order ?? 'ABBA'}`);
        const beforeResponse = await fetch('/api/world-comparison/meta', { signal: controller.signal });
        if (!beforeResponse.ok) throw new Error('Provenance indisponible.');
        const before = await beforeResponse.json();
        const result = await runWorldComparison(canvas, config, message => status(`Campagne ${completed + 1}/${planned.length} · ${message}`), controller.signal, metricHandler(),
          event => {
            if (event.phase === 'first-frame') onUpdate({ framePresented: true });
            const itemType = event.phase === 'asset-download' ? 'modèles' : event.phase === 'asset-decode' ? 'textures' : event.phase === 'scene-preparation' ? 'scène' : event.phase === 'gpu-drain' ? 'buffers' : 'scène';
            onUpdate({ progress: { phase: event.phase, itemType, ...(event.completed !== undefined ? { completed: event.completed } : {}), ...(event.total !== undefined ? { total: event.total } : {}), ...(event.assetBytes !== undefined ? { bytesLoaded: event.assetBytes } : {}), message: event.message } });
          });
        const afterResponse = await fetch('/api/world-comparison/meta', { signal: controller.signal });
        if (!afterResponse.ok) throw new Error('Provenance finale indisponible.');
        const after = await afterResponse.json();
        const sourcesStable = before.commit === after.commit && JSON.stringify(before.sourceHashes) === JSON.stringify(after.sourceHashes);
        if (!sourcesStable) result.limitations.push('INVALID: sources changed during this campaign; timings are not accepted as comparative evidence.');
        const report: SavedWorldReport = { ...result, test: '14-open-world', provenance: { before, after, sourcesStable } };
        execution = { ...execution, lastCampaign: campaignSummary(report) ?? execution.lastCampaign };
        currentReport = report; currentMarkdown = formatWorldReport(report); pending = { report, markdown: currentMarkdown };
        await save(controller.signal);
        if (controller.signal.aborted || disposed) break;
        completed++;
        if (!sourcesStable) throw new Error('Sources modifiées pendant le test : rapport archivé sans remplacer la dernière campagne, mesures non recevables.');
        if (!result.quality.passed) throw new Error(`Contrôle des images refusé : ${result.quality.failure}. Rapport conservé.`);
      }
      execution = { ...execution, status: controller.signal.aborted ? 'stopped' : 'completed' };
      status(controller.signal.aborted ? `Campagne arrêtée. ${completed} rapport(s) conservé(s).` : `${completed} campagne(s) terminée(s) et archivée(s). Ouvrir « Voir rapport ».`);
    } catch (error) { execution = { ...execution, status: controller.signal.aborted ? 'stopped' : 'error' }; status(controller.signal.aborted ? 'Campagne arrêtée.' : String(error)); retryButton.classList.toggle('hidden', pending === null); }
    finally { active = null; busy(false); }
  }
  async function openFolder() {
    try {
      const response = await fetch('/api/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testId: '14-open-world', folder: 'reports' }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`); text('modal-feedback', 'Dossier des rapports ouvert.');
    } catch (error) { text('open-report-hint', `Ouverture indisponible : ${String(error)}`); }
  }
  // Navigation belongs exclusively to LabNavbar. This imperative
  // workbench must never compete for the global module selector.
  on(controls, 'change', updatePlan); on(modeControls, 'change', updatePlan); on(countSelect, 'change', updatePlan);
  on(runButton, 'click', () => { void run(); }); on(stopButton, 'click', () => { stop(); status('Arrêt demandé.'); });
  on(retryButton, 'click', async () => { retryButton.disabled = true; try { await save(); status('Rapport sauvegardé.'); busy(false); } catch (error) { status(String(error)); } finally { retryButton.disabled = false; } });
  on(el('btn-view-report'), 'click', openReport); on(el('btn-refresh-report'), 'click', openReport);
  on(el('btn-open-reports'), 'click', () => { void openFolder(); }); on(el('btn-modal-open-finder'), 'click', () => { void openFolder(); });
  on(el('btn-copy-report'), 'click', async () => { try { if (!currentMarkdown) { text('modal-feedback', 'Choisir un rapport archivé pour lire son contenu.'); return; } await navigator.clipboard.writeText(currentMarkdown); text('modal-feedback', 'Rapport copié.'); } catch (error) { text('modal-feedback', String(error)); } });
  on(reportModal, 'close', () => { historyRequest?.abort(); });
  on(window, 'pagehide', () => { stop(); historyRequest?.abort(); for (const side of comparisonSides) compared[side].request?.abort(); listen.abort(); });
  on(window, 'pageshow', event => { if ((event as PageTransitionEvent).persisted) window.location.reload(); });
  const dispose = () => {
    disposed = true;
    stop();
    historyRequest?.abort();
    for (const side of comparisonSides) compared[side].request?.abort();
    listen.abort();
  };
  status('Prêt. A ou B affiche le décor ; « Mesurer et comparer » lance la campagne.');
  updatePlan();
  return { run: () => { void run(); }, setMode: (mode: 'classic' | 'gpu-driven') => selectMode(mode === 'gpu-driven'), setScenario: setDistricts, report: openReport, stop, dispose };
}
