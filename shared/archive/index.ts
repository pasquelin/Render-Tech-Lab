export * from './retention.ts';
export * from './reportStore.ts';
export * from './atomic.ts';
export * from './completeReport.ts';
export * from './streamReport.ts';
export * from './reportPackage.ts';

export async function readLegacyJson<T>(file: string): Promise<T | null> {
  const { readFile } = await import('node:fs/promises');
  try { return JSON.parse(await readFile(file, 'utf8')) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
