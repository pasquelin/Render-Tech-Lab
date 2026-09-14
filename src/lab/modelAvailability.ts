import { modelById, benchmarkModels } from '../../15-virtualized-integration/index.ts';
import { assertCachePointer, assertCacheReady } from '@web-geometry/sdk';

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
  // Le format du cache appartient au SDK : l'hôte lit deux JSON, vérifie que l'adresse reste dans son
  // propre dossier de modèle, et laisse le SDK dire si ce cache est utilisable.
  const manifestUrl = modelManifestUrl(modelId);
  const pointerUrl = assertCachePointer(await read(manifestUrl), 'full');
  const base = new URL(manifestUrl, 'http://localhost');
  const target = new URL(pointerUrl, base);
  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname.replace(/manifest\.json$/, ''))) throw new Error('Adresse du cache de modèle invalide.');
  return assertCacheReady(await read(target.pathname), 'full');
}
