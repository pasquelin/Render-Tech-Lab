import { readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

export const CAMPAIGN_RETENTION_LIMIT = 2;

export async function comparisonRetention(directory: string, apply = false) {
  const names = await readdir(directory).catch(() => [] as string[]);
  const entries: Array<{ id: string; timestamp: number; files: string[] }> = [];
  for (const name of names) {
    if (!name.endsWith('.json') || name.endsWith('.sources.json')) continue;
    const id = name.slice(0, -5);
    try {
      const value = JSON.parse(await readFile(path.join(directory, name), 'utf8')) as { timestamp?: string };
      const timestamp = Date.parse(value.timestamp ?? '');
      if (!Number.isFinite(timestamp)) continue;
      entries.push({ id, timestamp, files: names.filter(candidate => candidate === `${id}.json` || candidate === `${id}.md` || candidate === `${id}.sources.json` || candidate.startsWith(`${id}.capture-`)) });
    } catch { /* Unknown/static files are protected. */ }
  }
  entries.sort((a, b) => b.timestamp - a.timestamp);
  const removed = entries.slice(CAMPAIGN_RETENTION_LIMIT);
  if (apply) for (const entry of removed) for (const file of entry.files) await rm(path.join(directory, file));
  return { before: entries.length, after: Math.min(entries.length, CAMPAIGN_RETENTION_LIMIT), removed };
}

export async function directoryRetention(directory: string, prefix: string, apply = false) {
  const names = (await readdir(directory, { withFileTypes: true }).catch(() => [])).filter(entry => entry.isDirectory() && entry.name.startsWith(prefix));
  const entries: Array<{ id: string; timestamp: number; files: string[] }> = [];
  for (const entry of names) {
    try {
      let rawText: string;
      try {
        rawText = await readFile(path.join(directory, entry.name, 'objects', 'manifest.json'), 'utf8');
      } catch {
        rawText = await readFile(path.join(directory, entry.name, 'raw.json'), 'utf8');
      }
      const value = JSON.parse(rawText) as { archivedAt?: string };
      const timestamp = Date.parse(value.archivedAt ?? '');
      if (Number.isFinite(timestamp)) entries.push({ id: entry.name, timestamp, files: [entry.name] });
    } catch { /* Unrecognized folders are protected. */ }
  }
  entries.sort((a, b) => b.timestamp - a.timestamp);
  const removed = entries.slice(CAMPAIGN_RETENTION_LIMIT);
  if (apply) for (const entry of removed) await rm(path.join(directory, entry.id), { recursive: true });
  return { before: entries.length, after: Math.min(entries.length, CAMPAIGN_RETENTION_LIMIT), removed };
}
