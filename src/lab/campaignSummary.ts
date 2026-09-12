import type { CampaignSummary } from './execution.ts';

/** Only recognized, completed measurement records are presented as history. */
export function campaignSummary(value: unknown): CampaignSummary | null {
  if (!value || typeof value !== 'object') return null;
  const report = value as Record<string, unknown>;
  if (typeof report.timestamp !== 'string' || !Number.isFinite(Date.parse(report.timestamp))) return null;
  if (report.test === '14-open-world' && (report.quality as { passed?: boolean } | undefined)?.passed === false) {
    const config = report.config as { districts?: number; width?: number; height?: number } | undefined;
    return { timestamp: report.timestamp, status: 'Rejetée · aucune mesure de performance', configuration: `${config?.districts ?? '?'} quartiers · ${config?.width ?? '?'} × ${config?.height ?? '?'} px`, series: [] };
  }
  if (report.test === '03-gpu-scene' && Array.isArray(report.results)) {
    const rows = report.results as Array<Record<string, unknown>>;
    const values = (mode: string) => rows.filter(row => row.mode === mode).flatMap(row => typeof row.avgCpuSubmitMs === 'number' && Number.isFinite(row.avgCpuSubmitMs) ? [row.avgCpuSubmitMs] : []);
    const classic = values('classic'); const gpu = values('gpu-scene');
    if (!classic.length || classic.length !== gpu.length) return null;
    return { timestamp: report.timestamp, status: 'Terminée', configuration: `Matrice 4D · ${classic.length} scénarios · ${rows.length} blocs A/B`, series: [
      { label: 'A · Three.js multi-maillages', values: classic, unit: 'ms CPU submit' },
      { label: 'B · WebGPU GPU-Scene', values: gpu, unit: 'ms CPU submit' },
    ] };
  }
  if (typeof report.test === 'string' && Array.isArray(report.records) && report.status === 'measured') {
    const rows = report.records as Array<Record<string, unknown>>;
    const cpu = rows.flatMap(row => typeof row.cpuMs === 'number' && Number.isFinite(row.cpuMs) ? [row.cpuMs] : []);
    const gpu = rows.flatMap(row => typeof row.gpuMs === 'number' && Number.isFinite(row.gpuMs) ? [row.gpuMs] : []);
    if (!cpu.length && !gpu.length) return null;
    const scenarioLabels: Record<string, string> = { 'exact-resident': 'Résidence complète', 'lod-resident': 'Niveau de détail résident', 'streaming-pressure': 'Pression du streaming' };
    const scenarioChecks = report.test === '15-virtualized-integration' ? Object.entries(scenarioLabels).map(([id, label]) => {
      const variants = rows.map(row => String(row.variant).split(':')).filter(parts => parts[0] === id);
      const scenarios = ((report.archive as { virtualized?: { scenarios?: Array<{ id?: string; quality?: Array<{ passed?: boolean }> }> } } | undefined)?.virtualized?.scenarios ?? []);
      const scenario = scenarios.find(value => value.id === id);
      return { id, label, a: variants.filter(parts => parts[1] === 'A').length, b: variants.filter(parts => parts[1] === 'B').length, quality: scenario?.quality?.every(check => check.passed === true) ? 'Qualité validée' : 'Qualité non validée' };
    }) : undefined;
    return { timestamp: report.timestamp, status: 'Mesurée', configuration: report.test === '15-virtualized-integration' ? '3 scénarios procéduraux · contrôles A/B' : rows.map(row => String(row.variant)).join(' / '), scenarioChecks, series: [
      ...(cpu.length ? [{ label: rows.every(row => String((row.custom as { scope?: string } | undefined)?.scope).startsWith('cpu-')) ? 'Temps oracle CPU' : rows.some(row => (row.custom as { scope?: string } | undefined)?.scope === 'webgpu-physical') ? 'Encodage et soumission JS' : 'Durée CPU mesurée', values: cpu, unit: 'ms' }] : []),
      ...(gpu.length ? [{ label: 'Durée GPU mesurée', values: gpu, unit: 'ms GPU' }] : []),
    ] };
  }
  if (Array.isArray(report.tiers) && Array.isArray(report.classicResults) && Array.isArray(report.gpuDrivenResults)) {
    const readSeries = (rows: unknown) => (rows as Array<Record<string, unknown>>).flatMap(row =>
      typeof row.avgSubmitMs === 'number' && Number.isFinite(row.avgSubmitMs) ? [row.avgSubmitMs] : []);
    const classic = readSeries(report.classicResults);
    const gpu = readSeries(report.gpuDrivenResults);
    if (!classic.length || !gpu.length) return null;
    return { timestamp: report.timestamp, status: 'Terminée', configuration: `${report.tiers.join(' / ')} objets`, series: [
      { label: 'A · Three.js WebGL', values: classic, unit: 'ms CPU submit' },
      { label: 'B · WebGPU natif', values: gpu, unit: 'ms CPU submit' },
    ] };
  }
  if (!Array.isArray(report.blocks)) {
    if (report.status !== 'measured') return null;
    const cpu = report.cpu as { frameMs?: unknown } | undefined;
    if (typeof cpu?.frameMs !== 'number' || !Number.isFinite(cpu.frameMs)) return null;
    return { timestamp: report.timestamp, status: 'Mesurée', configuration: String(report.test ?? 'Configuration dans le rapport'),
      series: [{ label: 'Mesure archivée', unit: 'ms CPU frame', values: [cpu.frameMs] }] };
  }
  const world = report.test === '14-open-world' && (report.quality as { passed?: boolean } | undefined)?.passed === true;
  const blocks = report.blocks.filter((b): b is Record<string, unknown> => !!b && typeof b === 'object' && (b.completed === true || world && Array.isArray(b.samples) && b.samples.length > 0));
  const series = (world ? [...new Set(blocks.map(b => String(b.variant)))] : ['cpu', 'gpu']).map(variant => ({ label: world ? variant : variant === 'cpu' ? 'A · CPU' : 'B · GPU', unit: 'ms CPU frame',
    values: blocks.filter(b => b.variant === variant).flatMap(b => {
      const summary = b.summary as { cpuFrameWorkMs?: { mean?: unknown } } | undefined;
      const mean = summary?.cpuFrameWorkMs?.mean;
      return typeof mean === 'number' && Number.isFinite(mean) && mean >= 0 ? [mean] : [];
    }) }));
  if (!series.some(s => s.values.length)) return null;
  const config = report.config as { count?: number; districts?: number; width?: number; height?: number } | undefined;
  return { timestamp: report.timestamp, status: String(report.status ?? 'Statut indisponible'),
    configuration: `${config?.count ?? config?.districts ?? '?'} ${world ? 'quartiers' : 'objets'} · ${config?.width ?? '?'} × ${config?.height ?? '?'} px`, series };
}
