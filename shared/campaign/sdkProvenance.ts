/**
 * Provenance du SDK lu par le banc 15 : commit du checkout dont vient `dist/`, drapeau dirty,
 * et hash de contenu déjà produit par le SDK.
 *
 * `dist/sdk-browser/buildProvenance.js` ne porte qu'un hash de contenu : ni commit, ni état du
 * dépôt. Le commit est donc relevé ici, côté Lab, par `git rev-parse HEAD` sur le checkout.
 *
 * « dirty » veut dire : des fichiers suivis par git sont modifiés, donc le commit consigné ne
 * décrit plus la source mesurée. Les fichiers non suivis ne comptent pas : un checkout du moteur
 * porte des dossiers de travail (orchestration/, sorties de build) qui ne changent pas une mesure.
 */

import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type { SdkProvenance } from './truthReport.ts';

const run = promisify(execFile);

/** Checkout du SDK d'où provient un `dist/` donné. */
export function sdkCheckoutFor(distPath: string): string {
  return path.dirname(path.resolve(distPath));
}

/**
 * Checkout du SDK lié au Lab : cible réelle du lien `node_modules/@web-geometry/sdk`. Résolu par le
 * lien plutôt que par un chemin relatif, pour rester juste depuis un worktree du Lab.
 */
export function sdkCheckoutFromLink(labRoot: string): string {
  try { return realpathSync(path.join(labRoot, 'node_modules', '@web-geometry', 'sdk')); }
  catch { return path.resolve(labRoot, '../webGeometry'); }
}

/** Chemin `dist/` effectif : `SDK_DIST` s'il est posé, sinon le `dist/` du checkout lié. */
export function sdkDistPath(env: Record<string, string | undefined>, linkedCheckout: string): string {
  return env.SDK_DIST ? path.resolve(env.SDK_DIST) : path.join(path.resolve(linkedCheckout), 'dist');
}

async function gitCommit(checkout: string) {
  try {
    const head = await run('git', ['-C', checkout, 'rev-parse', 'HEAD']);
    const status = await run('git', ['-C', checkout, 'status', '--porcelain', '--untracked-files=no']);
    return { commit: head.stdout.trim() || null, dirty: status.stdout.trim().length > 0 };
  } catch {
    return { commit: null, dirty: null };
  }
}

async function contentHash(distPath: string) {
  try {
    const module = await import(pathToFileURL(path.join(distPath, 'sdk-browser', 'buildProvenance.js')).href) as { SDK_BUILD_PROVENANCE?: { hash?: unknown; generatedAt?: unknown } };
    const provenance = module.SDK_BUILD_PROVENANCE ?? {};
    return {
      contentHash: typeof provenance.hash === 'string' ? provenance.hash : null,
      generatedAt: typeof provenance.generatedAt === 'string' ? provenance.generatedAt : null,
    };
  } catch {
    return { contentHash: null, generatedAt: null };
  }
}

/** Relève la provenance complète du SDK. Tout ce qui n'est pas lisible vaut `null`. */
export async function readSdkProvenance(distPath: string): Promise<SdkProvenance> {
  const checkout = sdkCheckoutFor(distPath);
  const [head, hash] = await Promise.all([gitCommit(checkout), contentHash(distPath)]);
  return { commit: head.commit, dirty: head.dirty, checkout, distPath: path.resolve(distPath), ...hash };
}
