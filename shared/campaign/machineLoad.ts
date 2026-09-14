/**
 * Relevé de charge machine joint à chaque bloc de mesure. Lu côté Node : les scripts headless
 * l'appellent directement, l'interface le demande au serveur de développement.
 */

import { execFileSync } from 'node:child_process';
import type { MachineLoad } from './truthReport.ts';

export type MachineLoadDetail = MachineLoad & { uptime: string | null; processes: string[] };

function text(command: string, args: string[]) {
  try { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

/** Relevé complet. Ce que le système n'expose pas vaut `null`. */
export function readMachineLoad(): MachineLoadDetail {
  const uptime = text('uptime', []);
  const averages = uptime?.match(/load averages?:\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/) ?? null;
  const listing = text('/bin/sh', ['-c', "ps -Ao pid,pcpu,comm | grep -Ei 'Google Chrome|web-geometry-compiler|cargo|vite|node' | grep -v grep || true"]) ?? '';
  const lines = listing.split('\n').filter(Boolean);
  return {
    at: new Date().toISOString(),
    uptime,
    thermal: text('pmset', ['-g', 'therm']),
    load1: averages ? Number(averages[1]) : null,
    load5: averages ? Number(averages[2]) : null,
    load15: averages ? Number(averages[3]) : null,
    chromeProcesses: lines.filter(line => /Google Chrome/i.test(line)).length,
    compilerProcesses: lines.filter(line => /web-geometry-compiler|cargo/i.test(line)).length,
    viteProcesses: lines.filter(line => /vite/i.test(line)).length,
    processes: lines.filter(line => !/\s\d+\.\d+\s+node$/.test(line)).slice(0, 40),
  };
}

/** Relevé réduit aux champs du rapport de campagne. */
export function machineLoadForReport(load: MachineLoadDetail): MachineLoad {
  const { at, load1, load5, load15, thermal, chromeProcesses, compilerProcesses, viteProcesses } = load;
  return { at, load1, load5, load15, thermal, chromeProcesses, compilerProcesses, viteProcesses };
}
