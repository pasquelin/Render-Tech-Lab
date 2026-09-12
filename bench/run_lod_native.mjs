import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 5188;

async function main() {
  console.log('🚀 Démarrage du serveur Vite dev sur le port', port);
  const server = await createServer({
    root,
    server: { port, strictPort: true, host: '127.0.0.1' },
    configFile: path.join(root, 'vite.config.ts'),
  });
  await server.listen();

  let browser;
  try {
    const chromeArgs = [
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,UseSkiaRenderer,WebGPU',
      '--use-angle=metal',
      '--disable-gpu-watchdog',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ];

    console.log('🌐 Lancement de Google Chrome avec WebGPU activé...');
    browser = await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: chromeArgs,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    page.on('console', msg => {
      const text = msg.text();
      if (/error|warn|rejet|échec|mismatch/i.test(text)) {
        console.log(`[Browser Console ${msg.type()}] ${text}`);
      }
    });
    page.on('pageerror', err => {
      console.error(`[Browser PageError]`, err.message);
    });

    const targetUrl = `http://127.0.0.1:${port}/?test=04-gpu-lod&count=50000&resolution=3840,2160&samples=240&warmup=60&repeats=1`;
    console.log(`📍 Navigation vers : ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Attente du montage du workbench natif
    await page.waitForFunction(() => !!window.__renderTechLabNative, null, { timeout: 30_000 });
    console.log('✅ Workbench natif 04-gpu-lod monté.');

    // Vérification des sélections UI
    const selectedCount = await page.$eval('#select-count', el => el.value);
    const selectedRes = await page.$eval('#native-resolution', el => el.value);
    console.log(`⚙️ Configuration active : ${selectedCount} objets, résolution ${selectedRes}`);

    // Déclenchement de la comparaison
    console.log('⏳ Déclenchement de la campagne "Comparer CPU / GPU natif"...');
    await page.evaluate(() => {
      window.__renderTechLabNative.run();
    });

    // Attente que le bench commence
    await page.waitForFunction(() => window.__renderTechLabNative.isBusy(), null, { timeout: 10_000 });
    console.log('🏃 Campagne en cours...');

    // Polling du statut jusqu'à complétion
    let lastStatus = '';
    const startTime = Date.now();
    const maxDuration = 180_000; // 3 minutes max

    while (Date.now() - startTime < maxDuration) {
      const isBusy = await page.evaluate(() => window.__renderTechLabNative.isBusy());
      const status = await page.evaluate(() => window.__renderTechLabNative.getStatus());
      if (status !== lastStatus) {
        console.log(`  [Progression] ${status}`);
        lastStatus = status;
      }

      if (!isBusy) {
        console.log('🏁 Campagne terminée.');
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    // Récupération de l'historique récent via l'API
    const historyRes = await fetch(`http://127.0.0.1:${port}/api/lod-comparison/history`);
    if (!historyRes.ok) throw new Error(`Échec fetch history: HTTP ${historyRes.status}`);
    const historyData = await historyRes.json();
    const latestRun = historyData.runs?.[0];

    if (!latestRun) throw new Error('Aucun run trouvé dans /api/lod-comparison/history !');
    console.log(`📋 Dernier run archivé : ${latestRun.id} (timestamp: ${latestRun.timestamp})`);

    // Récupération du JSON brut
    const runRes = await fetch(`http://127.0.0.1:${port}${latestRun.jsonUrl}`);
    if (!runRes.ok) throw new Error(`Échec fetch run data: HTTP ${runRes.status}`);
    const runData = await runRes.json();

    console.log('======================================================');
    console.log(`STATUT GLOBAL       : ${runData.status}`);
    console.log(`QUALITÉ PASSÉE      : ${runData.quality?.passed}`);
    console.log(`TIMINGS ACCEPTÉS    : ${runData.quality?.timingsAccepted}`);
    if (runData.failure) console.log(`CAUSE D'ÉCHEC       : ${runData.failure}`);

    const controls = runData.controls || [];
    for (const ctrl of controls) {
      const r = ctrl.result;
      console.log(`--- Contrôle ${ctrl.phase} (Pose ${r.frameIndex}) ---`);
      console.log(`  passed                      : ${r.passed}`);
      console.log(`  selectionMismatches         : ${r.selectionMismatches}`);
      console.log(`  compactedIdentityMismatches : ${r.compactedIdentityMismatches}`);
      console.log(`  compactedOrderMismatches    : ${r.compactedOrderMismatches}`);
      console.log(`  commandMismatches           : ${r.commandMismatches}`);
      console.log(`  aaDifferentPixels (reprod)  : ${r.captures?.aaDifferentPixels}`);
      console.log(`  abDifferentPixels (CPU/GPU) : ${r.captures?.abDifferentPixels}`);
      console.log(`  abMaxChannelError           : ${r.captures?.abMaxChannelError}`);
    }

    const blocks = runData.blocks || [];
    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b];
      console.log(`--- Bloc ${b + 1} (${block.variant}) ---`);
      console.log(`  samples   : ${block.samples?.length}`);
      console.log(`  cadence   : ${block.cadence?.fps?.toFixed(1)} FPS`);
      console.log(`  cpuSelect : ${block.summary?.cpuSelectMs?.mean?.toFixed(3)} ms`);
      console.log(`  cpuSubmit : ${block.summary?.cpuRenderSubmitMs?.mean?.toFixed(3)} ms`);
      console.log(`  gpuMs     : ${block.summary?.gpuMs?.mean?.toFixed(3)} ms`);
      if (block.variant === 'gpu') {
        console.log(`  gpuSelect : ${block.summary?.gpuSelectMs?.mean?.toFixed(3)} ms`);
        console.log(`  gpuCount  : ${block.summary?.gpuCountMs?.mean?.toFixed(3)} ms`);
        console.log(`  gpuScatter: ${block.summary?.gpuScatterMs?.mean?.toFixed(3)} ms`);
        console.log(`  gpuRender : ${block.summary?.gpuRenderMs?.mean?.toFixed(3)} ms`);
      }
    }
    console.log('======================================================');

    // Assertions oracles
    if (runData.status !== 'completed') {
      throw new Error(`La campagne a échoué avec le statut : ${runData.status} (échec: ${runData.failure})`);
    }
    for (const ctrl of controls) {
      if (ctrl.result.captures?.abDifferentPixels !== 0) {
        throw new Error(`Écart de pixel persistant : ${ctrl.result.captures?.abDifferentPixels} pixels différents à la pose ${ctrl.result.frameIndex} !`);
      }
      if (ctrl.result.compactedOrderMismatches !== 0) {
        throw new Error(`Écart d'ordre de compaction : ${ctrl.result.compactedOrderMismatches} mismatches !`);
      }
    }

    console.log('🎉 TOUS LES CONTRÔLES QUALITÉ ONT RÉUSSI AVEC ZÉRO PIXEL DE DIFFÉRENCE !');
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}

main().catch(err => {
  console.error('❌ Erreur script:', err);
  process.exitCode = 1;
});
