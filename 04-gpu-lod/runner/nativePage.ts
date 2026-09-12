import { createControlLock } from '../../src/lab/controlLock.ts';
import type { LabSnapshot } from '../../src/lab/labState.ts';
import { campaignSummary } from '../../src/lab/campaignSummary.ts';
import { runNativeComparison, formatNativeReport, type NativeComparisonOptions, type NativeComparisonMetrics, type NativeComparisonReport } from './nativeComparison.ts';
import { GenericLabChart } from '../../src/lab/GenericLabChart.ts';

/** The native backend mounts into the existing laboratory shell, before other runners initialize. */
export function mountNativeLodWorkbench(formatMarkdown: (markdown: string) => string, onUpdate: (patch: Partial<LabSnapshot>) => void = () => {}) {
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const text = (id: string, value: string) => { el(id).textContent = value; };
  let execution: LabSnapshot['execution'] = { status: 'idle', phase: '', lastCampaign: null };
  const status = (value: string) => {
    text('bench-status', value);
    liveChart?.setStatus(value);
    execution = { ...execution, phase: value };
    const phaseMode = /A · Référence CPU/.test(value) ? 'classic' : /B · Calcul WGSL/.test(value) ? 'gpu-driven' : null;
    const count = value.match(/(\d+)\/(\d+)/);
    const itemType = /shader|WGSL/i.test(value) ? 'shaders' : /objet|niveau|géométr/i.test(value) ? 'meshes' : /buffer|readback/i.test(value) ? 'buffers' : 'scène';
    onUpdate({ benchStatus: value, execution, progress: { phase: value, itemType, ...(count ? { completed: Number(count[1]), total: Number(count[2]) } : {}), message: value }, ...(phaseMode ? { mode: phaseMode, classicActive: phaseMode === 'classic' } : {}) });
  };
  let canvas = el<HTMLCanvasElement>('canvas-webgpu');
  const run = el<HTMLButtonElement>('btn-benchmark'), stop = el<HTMLButtonElement>('btn-pain-benchmark');
  const a = el<HTMLButtonElement>('btn-classic'), b = el<HTMLButtonElement>('btn-gpu-driven');
  const counts = el<HTMLSelectElement>('select-count'), modules = el<HTMLSelectElement>('select-module');
  const modal = el<HTMLDialogElement>('report-modal');
  let active: AbortController | null = null;
  let markdown = '', pending: {report: unknown; markdown: string} | null = null;
  let archive: {jsonUrl: string; markdownUrl: string; sourcesUrl?: string} | null = null;
  let liveChart = new GenericLabChart(el<HTMLCanvasElement>('canvas-chart'));
  const livePoints: { label: string; valA: number | null; valB: number | null }[] = [];
  let finalCanvas: HTMLCanvasElement | null = null;
  const mountCampaignSurfaces = () => {
    canvas = el<HTMLCanvasElement>('canvas-webgpu');
    liveChart.dispose();
    liveChart = new GenericLabChart(el<HTMLCanvasElement>('canvas-chart'));
    finalCanvas = document.createElement('canvas');
    finalCanvas.id = 'native-final-image';
    finalCanvas.className = canvas.className;
    finalCanvas.style.objectFit = 'cover';
    finalCanvas.style.display = 'none';
    finalCanvas.setAttribute('aria-label', 'Dernière image contrôlée de la campagne terminée');
    canvas.after(finalCanvas);
  };
  const clearFinalImage = () => { if (finalCanvas) finalCanvas.style.display = 'none'; canvas.style.display = ''; };
  const diagnostic = (values: { selection: string; gpu: string; lod: string; triangles: string; shadows?: string }) => {
    text('native-selection-value', values.selection);
    text('native-gpu-value', values.gpu);
    text('native-lod-value', values.lod);
    text('native-triangles-value', values.triangles);
    text('native-shadows-value', values.shadows ?? '0');
  };
  const preserveFinalImage = (image: ImageData) => {
    if (!finalCanvas) return;
    finalCanvas.width = image.width; finalCanvas.height = image.height;
    finalCanvas.getContext('2d')!.putImageData(image, 0, 0);
    finalCanvas.style.display = ''; canvas.style.display = 'none';
  };
  function showSummary(report: NativeComparisonReport, finalize = true) {
    const block = report.blocks.slice().reverse().find(block => block.completed && block.samples.length > 0);
    if (block) {
      text('stat-submit', ms(block.summary.cpuRenderSubmitMs?.mean));
      text('stat-cpuframe', ms(block.summary.cpuFrameWorkMs?.mean));
      text('stat-fps', block.cadence.fps === null ? 'Non mesuré' : `${block.cadence.fps.toFixed(1)} FPS`);
      text('stat-drawcalls', String(block.samples.at(-1)!.drawCalls));
      text('stat-objects', String(report.config.count));
      const gpuSelection = block.summary.gpuSelectMs?.mean;
      diagnostic({
        selection: block.variant === 'cpu' ? `CPU · ${ms(block.summary.cpuSelectMs?.mean)}` : `GPU · ${ms(gpuSelection)}`,
        gpu: block.variant === 'gpu' ? (gpuSelection == null ? 'Non mesurée · timestamp indisponible' : ms(gpuSelection)) : 'Hors mode actif',
        lod: `${block.samples.length} images contrôlées`,
        triangles: block.samples.at(-1)!.mainPassTriangles?.toLocaleString('fr-FR') ?? 'Contrôles archivés',
      });
    }
    execution = { ...execution, status: finalize ? (report.status === 'completed' ? 'completed' : report.status === 'aborted' ? 'stopped' : 'error') : 'running', lastCampaign: campaignSummary(report) ?? execution.lastCampaign };
    onUpdate({ execution });
    text('stat-mode', report.status === 'completed' ? 'Campagne terminée' : report.status === 'aborted' ? 'Arrêt manuel · mesures complètes conservées' : 'Campagne rejetée');
    publishStats();
  }
  modules.value = '04-gpu-lod';
  for (const option of modules.options) option.classList.toggle('active', option.selected);
  document.title = '04 · LOD WebGPU natif — Render Tech Lab';
  text('nav-module-title', '04 · GPU LOD & Screen-Space Error');
  el('view-baseline').classList.add('hidden'); el('viewport-workbench').classList.add('hidden');
  el('canvas-webgl').style.display = 'none'; canvas.style.display = ''; canvas.style.objectFit = 'cover';
  el('canvas-chart').parentElement!.classList.remove('hidden');
  liveChart.setActive(true);
  el('btn-lod-comparison').classList.add('hidden');
  text('viewport-telemetry-mode', 'LOD · WebGPU natif');
  text('viewport-telemetry-detail', 'A : calcul CPU de référence · B : calcul WGSL · raster commun');
  text('stat-mode', 'Aperçu arrêté');
  text('open-report-hint', '04-gpu-lod/results/comparisons/');
  stop.style.display = 'none';
  onUpdate({ benchLabel: 'Comparer le LOD CPU et GPU', painLabel: 'Arrêter' });
  el('lab-mode-card').children[1].textContent = 'Même rendu natif ; sélection LOD de référence sur CPU ou portée en WGSL.';
  const urlParams = new URLSearchParams(window.location.search);
  const initialRes = urlParams.get('resolution') ?? (urlParams.get('res') === '4k' ? '3840,2160' : '1920,1080');
  const initialSamples = urlParams.get('samples') ?? '240';
  const initialWarmup = urlParams.get('warmup') ?? '60';
  const initialRepeats = urlParams.get('repeats') ?? '2';

  for (const id of ['stat-submit','stat-cpuframe','stat-fps','stat-drawcalls','stat-objects']) text(id, 'Non mesuré');
  el('stat-fps').parentElement!.querySelector('.stat-desc')!.textContent = '1 000 / intervalle moyen';
  const frequency = el('lab-metrics-card').firstElementChild!.querySelector('.badge');
  if (frequency) frequency.textContent = '500 ms';
  el('lab-report-card').children[1].textContent = 'Rapports, données brutes et sources archivés pour chaque campagne.';
  el('lab-run-card').firstElementChild!.textContent = '3. Comparaison native';

  const settings = document.createElement('fieldset'); settings.className = 'space-y-3';
  const field = (id: string, label: string, values: Array<[string,string]>, initial: string) => {
    const holder = document.createElement('label'); holder.className = 'block text-xs text-base-content/70'; holder.append(label);
    const select = document.createElement('select'); select.id = id; select.className = `${counts.className} mt-1`;
    select.append(...values.map(([value, name]) => new Option(name,value,false,value===initial)));
    holder.append(select); settings.append(holder); return select;
  };
  const resolution = field('native-resolution','Résolution physique',[['1920,1080','Full HD'],['3840,2160','4K']],initialRes);
  const samples = field('native-samples','Images mesurées par bloc',[['120','120'],['240','240'],['480','480']],initialSamples);
  const warmup = field('native-warmup','Images d’échauffement par bloc',[['60','60'],['120','120']],initialWarmup);
  const repeats = field('native-repeats','Répétitions',[['1','1 · ABBA'],['2','2 · ABBA / BAAB']],initialRepeats);
  const scope = document.createElement('p'); scope.className = 'text-xs text-base-content/70';
  scope.textContent = 'Diagnostic du calcul de taille projetée, seuils 250/60 px. Géométrie détaillée du banc 04, caméra mobile. Matériau opaque commun, sans textures ni ombres. Ce test ne valide pas Bistro ni une borne d’erreur géométrique.';
  settings.append(scope); run.parentElement!.before(settings);
  const instrument = document.createElement('div'); instrument.id = 'native-instruments'; instrument.className = 'grid grid-cols-1 min-[300px]:grid-cols-2 gap-2 text-xs min-w-0';
  for (const [id, label] of [['selection','Sélection LOD'],['gpu','Temps GPU'],['lod','LOD / contrôles'],['triangles','Triangles soumis'],['shadows','Ombres']]) {
    const cell = document.createElement('div'); cell.className = 'min-w-0 rounded-lg bg-base-300/35 px-2 py-1.5';
    const title = document.createElement('div'); title.className = 'text-[10px] uppercase tracking-wide text-base-content/55'; title.textContent = label;
    const value = document.createElement('div'); value.id = `native-${id}-value`; value.className = 'mt-0.5 break-words font-mono leading-snug'; value.textContent = 'Non mesuré';
    cell.append(title, value); instrument.append(cell);
  }
  el('lab-metrics-card').append(instrument);
  const legacy = document.createElement('a'); legacy.href = '/?test=04-gpu-lod&backend=legacy'; legacy.className = 'btn btn-sm btn-lab-secondary w-full'; legacy.textContent = 'Études 04A / 04B archivées';
  el('lab-report-card').append(legacy);
  const history = document.createElement('div'); history.className = 'space-y-2 text-xs'; el('lab-report-card').append(history);
  const errata = document.createElement('a'); errata.href = '/04-gpu-lod/results/NATIVE-ERRATA.md'; errata.target = '_blank'; errata.rel = 'noopener'; errata.className = 'link text-xs'; errata.textContent = 'Rectifications et échecs des premiers essais natifs'; el('lab-report-card').append(errata);
  const retry = document.createElement('button'); retry.className = 'btn btn-sm btn-lab-secondary w-full hidden'; retry.textContent = 'Réessayer la sauvegarde'; el('lab-report-card').append(retry);
  const options = (order: NativeComparisonOptions['order'] = 'ABBA'): NativeComparisonOptions => {
    const [width,height] = resolution.value.split(',').map(Number);
    return {count:Number(counts.value),width,height,samples:Number(samples.value),warmup:Number(warmup.value),seed:417,order};
  };
  const lockControls = createControlLock(el('sidebar'));
  const busy = (value: boolean) => {
    lockControls(value);
    for (const node of [run,a,b,counts,modules,resolution,samples,warmup,repeats]) node.disabled = value;
    settings.disabled = value; stop.style.display = value ? '' : 'none';
    if (value) {
      execution = { status: 'running', phase: 'Préparer', lastCampaign: null };
      liveChart.setStatus('Préparation de la campagne native…');
    } else {
      finalCanvas?.remove();
      finalCanvas = null;
    }
    onUpdate({ running: value, ...(value ? { framePresented: false, progress: { phase: 'Préparer', itemType: 'scène', message: 'Préparation des niveaux de détail et du raster WebGPU.' } as const } : {}), execution });
  };
  const ms = (n: number | null | undefined) => n != null && Number.isFinite(n) ? `${n.toFixed(2)} ms` : 'Non mesuré';
  function metrics(m: NativeComparisonMetrics) {
    onUpdate({ framePresented: true });
    text('stat-submit', ms(m.cpuRenderSubmitMs)); text('stat-cpuframe',ms(m.cpuFrameWorkMs));
    text('stat-fps', m.fps != null ? `${m.fps.toFixed(1)} FPS` : 'Non mesuré'); text('stat-drawcalls','3');
    text('stat-mode', `${m.variant === 'cpu' ? 'A · Calcul CPU' : 'B · Calcul GPU'} · ${m.phase}`);
    onUpdate({ mode: m.variant === 'cpu' ? 'classic' : 'gpu-driven', classicActive: m.variant === 'cpu' });
    text('stat-objects', counts.value);
    publishStats();
    if (m.phase === 'measure' && m.cpuFrameWorkMs !== null && Number.isFinite(m.cpuFrameWorkMs)) {
      livePoints.push({ label: `${m.variant === 'cpu' ? 'A' : 'B'}${livePoints.length + 1}`,
        valA: m.variant === 'cpu' ? m.cpuFrameWorkMs : null,
        valB: m.variant === 'gpu' ? m.cpuFrameWorkMs : null });
      if (livePoints.length > 12) livePoints.shift();
      liveChart.update('Travail CPU pendant les blocs mesurés', 'ms', [...livePoints], livePoints.length - 1,
        m.variant === 'cpu' ? 'classic' : 'gpu-driven', { a: 'A · Calcul CPU', b: 'B · Calcul GPU' });
    }
    diagnostic({
      selection: m.variant === 'cpu' ? `CPU · ${ms(m.cpuSelectMs)}` : `GPU · ${ms(m.gpuSelectMs)}`,
      gpu: m.variant === 'gpu' ? (m.gpuSelectMs == null ? 'Non mesurée · disponible après le bloc' : ms(m.gpuSelectMs)) : 'Hors mode actif',
      lod: m.lodCounts?.join(' / ') ?? 'Contrôles archivés',
      triangles: m.triangles?.toLocaleString('fr-FR') ?? 'Contrôles archivés',
    });
  }
  function publishStats() {
    onUpdate({ stats: { submit: el('stat-submit').textContent!, cpuFrame: el('stat-cpuframe').textContent!, fps: el('stat-fps').textContent!, drawCalls: el('stat-drawcalls').textContent!, objects: el('stat-objects').textContent!, modeLabel: el('stat-mode').textContent! } });
  }
  const stopCampaign = () => { execution = { ...execution, status: 'stopped' }; status('Arrêt manuel · dernières mesures complètes conservées.'); active?.abort(); if (!active) busy(false); };
  const metadata = async () => { const r = await fetch('/api/lod-comparison/meta'); if (!r.ok) throw new Error(`Métadonnées : HTTP ${r.status}`); return await r.json(); };
  async function refreshHistory() {
    const r = await fetch('/api/lod-comparison/history'); if (!r.ok) return;
    const data = await r.json(); history.replaceChildren();
    for (const saved of data.runs.filter((item: {config: {backend?: string}}) => item.config.backend === 'webgpu-native').slice(0,10)) {
      const button = document.createElement('button'); button.className = 'btn btn-sm btn-lab-secondary w-full';
      button.textContent = `${new Date(saved.timestamp).toLocaleTimeString('fr-FR')} · ${saved.config.count} objets · ${saved.config.width} × ${saved.config.height} · ${saved.config.order}`;
      button.onclick = async () => { const response = await fetch(saved.markdownUrl); if(response.ok){markdown=await response.text();archive=saved;openReport();} };
      history.append(button);
    }
  }
  async function save() {
    if (!pending) return;
    const response = await fetch('/api/lod-comparison',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending)});
    if(!response.ok)throw new Error(`Sauvegarde : ${await response.text()}`);
    archive=await response.json(); pending=null; retry.classList.add('hidden'); await refreshHistory();
  }
  retry.onclick = () => { void save().then(()=>status('Rapport sauvegardé.')).catch(error=>status(String(error))); };
  function openReport() {
    text('modal-report-title','04 · Comparaison du calcul LOD en rendu natif');
    text('modal-report-path','04-gpu-lod/results/comparisons/');
    el('modal-report-body').innerHTML = formatMarkdown(markdown || 'Aucune campagne native exécutée.');
    if(archive){
      const links=document.createElement('p');links.className='flex gap-3';
      for(const [label,url] of [['Données brutes',archive.jsonUrl],['Rapport',archive.markdownUrl],['Sources',archive.sourcesUrl]])if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.className='link';link.textContent=label!;links.append(link);}
      el('modal-report-body').prepend(links);
    }
    modal.showModal();
  }
  el('btn-view-report').onclick = openReport; el('btn-refresh-report').onclick = openReport;
  el('btn-copy-report').onclick = () => { void navigator.clipboard.writeText(markdown); };
  const reveal = () => {
    void fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId: '04-gpu-lod', folder: 'reports' }),
    });
  };
  el('btn-open-reports').onclick = reveal; el('btn-modal-open-finder').onclick = reveal;
  const runCampaign = async () => {
    if(active || pending)return; const controller=new AbortController();active=controller;busy(true);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    mountCampaignSurfaces();
    livePoints.length = 0;
    liveChart.update('Travail CPU pendant les blocs mesurés', 'ms', [], 0, 'classic', { a: 'A · Calcul CPU', b: 'B · Calcul GPU' });
    status('Préparation de la campagne CPU / WGSL native.');
    try{
      for(let i=0;i<Number(repeats.value);i++){
        controller.signal.throwIfAborted(); const before=await metadata();
        clearFinalImage();
        const report=await runNativeComparison(canvas,options(i%2?'BAAB':'ABBA'),status,controller.signal,metrics,preserveFinalImage);
        showSummary(report, i === Number(repeats.value) - 1 || report.status !== 'completed');
        const after=await metadata(); const sourcesStable=JSON.stringify(before.sourceHashes)===JSON.stringify(after.sourceHashes);
        const saved={...report,provenance:{before,after,sourcesStable}};markdown=formatNativeReport(report);pending={report:saved,markdown};
        retry.classList.remove('hidden');await save();
        const terminal = report.status === 'completed' ? 'terminée' : report.status === 'aborted' ? 'arrêtée' : 'rejetée';
        status(`Campagne ${i+1}/${repeats.value} ${terminal}. Rapport et données archivés.`);
        if(report.status!=='completed')break;
      }
    }catch(error){execution = { ...execution, status: controller.signal.aborted ? 'stopped' : 'error' };status(String(error));}finally{active=null;busy(false);}
  };
  function selectMode(mode: 'classic' | 'gpu-driven') {
    if (active) return;
    const cpu = mode === 'classic';
    onUpdate({ mode, classicActive: cpu });
    text('stat-mode', cpu ? 'A · Calcul CPU' : 'B · Calcul GPU');
    diagnostic({ selection: cpu ? 'CPU · non exécutée' : 'GPU · non exécutée', gpu: 'Disponible au lancement', lod: 'Contrôles au lancement', triangles: 'Mesurés au lancement' });
    publishStats();
    status('Prêt · aucun moteur initialisé.');
  }
  function setScenario(value: string) {
    if (active || !['1000', '2000', '5000', '10000', '50000'].includes(value)) return;
    counts.value = value;
    text('stat-objects', value);
    onUpdate({ scenarioVal: value, scenarioOptions: Array.from(counts.options).map(option => ({ val: option.value, label: option.textContent ?? option.value, selected: option.value === value })), stats: { submit: 'Non mesuré', cpuFrame: 'Non mesuré', fps: 'Non mesuré', drawCalls: 'Non mesuré', objects: value, modeLabel: el('stat-mode').textContent! } });
    status(`Prêt · ${Number(value).toLocaleString('fr-FR')} objets seront utilisés par la prochaine campagne.`);
  }
  const dispose = () => {
    active?.abort();
    liveChart.dispose();
    finalCanvas?.remove();
    delete (window as unknown as { __renderTechLabNative?: unknown }).__renderTechLabNative;
  };
  window.addEventListener('pagehide', dispose, { once: true });
  status('Prêt : lancer la comparaison. Présentation recadrée pour remplir la scène ; résolution physique de mesure inchangée.');
  (window as unknown as { __renderTechLabNative?: unknown }).__renderTechLabNative = {
    run: () => { void runCampaign(); },
    isBusy: () => !!active,
    getStatus: () => el('bench-status').textContent,
    getPending: () => pending,
    getArchive: () => archive,
  };
  void refreshHistory().catch(error=>status(String(error)));
  if (urlParams.get('autorun') === '1') {
    setTimeout(() => { void runCampaign(); }, 300);
  }
  return {
    run: runCampaign,
    setMode: selectMode,
    setScenario,
    report: openReport,
    stop: stopCampaign,
    dispose,
  };
}
