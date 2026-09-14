import type { MachineLoad } from '../../shared/campaign/truthReport.ts';

/**
 * Charge machine du bloc, relevée par le serveur de développement : le navigateur n'a pas accès
 * aux moyennes de charge ni à l'état thermique. Un relevé indisponible vaut `null`.
 */
export async function readMachineLoad(fetcher: typeof fetch = fetch): Promise<MachineLoad | null> {
  try {
    const response = await fetcher('/api/machine-load');
    if (!response.ok) return null;
    return await response.json() as MachineLoad;
  } catch { return null; }
}
