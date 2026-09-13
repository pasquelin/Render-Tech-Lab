import { modelById, benchmarkModels } from '../../15-virtualized-integration/index.ts';

export function defaultModelId(): string {
  return benchmarkModels[0]?.id ?? '';
}

export function modelManifestUrl(modelId: string) {
  const model = modelById(modelId) ?? (benchmarkModels[0]?.id ? modelById(benchmarkModels[0].id) : undefined);
  if (!model) throw new Error(`Modèle inconnu : ${modelId}`);
  return `/${model.derivedDirectory.replace(/^public\//, '')}/native/full/manifest.json`;
}

export async function checkModelAvailability(modelId: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<number> {
  const read = async (url: string) => {
    const response = await fetcher(url, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Cache indisponible (HTTP ${response.status}). Préparez les modèles puis réessayez.`);
    if (!response.headers.get('content-type')?.includes('json')) throw new Error('Cache invalide : réponse JSON attendue. Préparez les modèles puis réessayez.');
    return response.json();
  };
  const manifestUrl = modelManifestUrl(modelId);
  const pointer = await read(manifestUrl);
  if (pointer.status !== 'ready' || pointer.scope !== 'full' || typeof pointer.url !== 'string') throw new Error('Manifeste de modèle incomplet. Préparez les modèles puis réessayez.');
  const base = new URL(manifestUrl, 'http://localhost');
  const target = new URL(pointer.url, base);
  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname.replace(/manifest\.json$/, ''))) throw new Error('Adresse du cache de modèle invalide.');
  const metadata = await read(target.pathname);
  if (metadata.status !== 'ready' || metadata.scope !== 'full' || metadata.schema !== 1 || !Array.isArray(metadata.primitives) || !Array.isArray(metadata.selectedNodes) || !Number.isFinite(metadata.selectedTriangles) || metadata.selectedTriangles <= 0) throw new Error('Cache de modèle invalide. Préparez les modèles puis réessayez.');
  if (metadata.simplification !== true) throw new Error('Cache sans pages QEM. Relancez pnpm prepare:models.');
  if (metadata.errorModel !== 'qem-local-plus-child-max') throw new Error('Cache QEM obsolète. Relancez pnpm prepare:models.');
  return metadata.selectedTriangles;
}
