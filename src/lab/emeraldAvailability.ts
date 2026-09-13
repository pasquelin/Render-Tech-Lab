export const emeraldManifestUrl = '/benchmark-assets/emerald-derived/native/full/manifest.json';
export async function checkEmeraldAvailability(fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<number> {
  const read = async (url: string) => {
    const response = await fetcher(url, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Cache indisponible (HTTP ${response.status}). Préparez Emerald puis réessayez.`);
    if (!response.headers.get('content-type')?.includes('json')) throw new Error('Cache invalide : réponse JSON attendue. Préparez Emerald puis réessayez.');
    return response.json();
  };
  const pointer = await read(emeraldManifestUrl);
  if (pointer.status !== 'ready' || pointer.scope !== 'full' || typeof pointer.url !== 'string') throw new Error('Manifeste Emerald incomplet. Préparez Emerald puis réessayez.');
  const base = new URL(emeraldManifestUrl, 'http://localhost');
  const target = new URL(pointer.url, base);
  if (target.origin !== base.origin || !target.pathname.startsWith('/benchmark-assets/emerald-derived/native/')) throw new Error('Adresse du cache Emerald invalide.');
  const metadata = await read(target.pathname);
  if (metadata.status !== 'ready' || metadata.scope !== 'full' || metadata.schema !== 1 || !Array.isArray(metadata.primitives) || !Array.isArray(metadata.selectedNodes) || !Number.isFinite(metadata.selectedTriangles) || metadata.selectedTriangles <= 0) throw new Error('Cache Emerald invalide. Préparez Emerald puis réessayez.');
  if (metadata.simplification !== true) throw new Error('Cache sans pages QEM. Relancez npm run prepare:emerald.');
  if (metadata.errorModel !== 'qem-local-plus-child-max') throw new Error('Cache QEM obsolète (modèle d’erreur manquant). Relancez npm run prepare:emerald.');
  return metadata.selectedTriangles;
}
