import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.LAB_URL ?? 'http://127.0.0.1:5174';
const webgpuChrome = process.env.BENCH02_WEBGPU === '1';
const browser = await chromium.launch(webgpuChrome ? {
  channel: 'chrome',
  headless: false,
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,UseSkiaRenderer,WebGPU', '--use-angle=metal', '--disable-gpu-watchdog'],
} : { headless: true });

const pixels = canvas => canvas.evaluate(node => {
  const context = node.getContext('2d');
  const { width, height } = node;
  const data = context.getImageData(0, 0, width, height).data;
  let hash = 2166136261;
  let minimum = 255;
  let maximum = 0;
  for (let offset = 0; offset < data.length; offset += 16) {
    const value = data[offset] + data[offset + 1] + data[offset + 2];
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
    hash = Math.imul(hash ^ value, 16777619) >>> 0;
  }
  return { hash, spread: maximum - minimum };
});

try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));

  const open02 = async (instanceCount = '2000') => {
    await page.locator('#select-module').selectOption('02-gpu-frustum-culling');
    await page.locator('[data-execution-view="idle"]').waitFor();
    await page.locator('#select-count').selectOption(instanceCount);
    assert.equal(await page.locator('#select-count').inputValue(), instanceCount, `02 n’applique pas l’option ${instanceCount}`);
    assert.equal((await page.locator('#stat-objects').innerText()).replace(/\D/g, ''), instanceCount, `02 télémétrie incohérente pour ${instanceCount}`);
    assert.equal(await page.locator('canvas').count(), 0, '02 crée un canvas avant le lancement');
    await page.evaluate(() => {
      window.__bench02SawLoader = false;
      window.__bench02LoaderObserver?.disconnect();
      window.__bench02LoaderObserver = new MutationObserver(() => {
        if (document.querySelector('[data-render-loading="true"]')) window.__bench02SawLoader = true;
      });
      window.__bench02LoaderObserver.observe(document.body, { childList: true, subtree: true });
    });
    await page.locator('#btn-benchmark').click();
    const scene = page.locator('canvas[data-bench-scene="02-gpu-frustum-culling"]');
    await scene.waitFor({ state: 'visible' });
    assert.equal(await scene.getAttribute('data-instance-count'), instanceCount, `02 scène incohérente pour ${instanceCount}`);
    assert.equal(await page.evaluate(() => window.__bench02SawLoader), true, '02 n’affiche pas le loader avant sa scène');
    await page.locator('[data-render-loading="true"]').waitFor({ state: 'hidden' });
    const first = await pixels(scene);
    assert.ok(first.spread > 100, `02 produit une image uniforme (écart ${first.spread})`);
    await page.waitForTimeout(180);
    const second = await pixels(scene);
    assert.notEqual(second.hash, first.hash, '02 ne produit aucun changement de pixels pendant l’animation');
    await page.waitForFunction(() => {
      const terminal = document.querySelector('[data-execution-view="completed"],[data-execution-view="error"],[data-execution-view="stopped"]');
      const values = ['#stat-submit', '#stat-cpuframe'].map(selector => document.querySelector(selector)?.textContent ?? '');
      return terminal || values.some(value => !/non mesur|--|—/i.test(value));
    }, null, { timeout: 120_000 });
    const measured = (await Promise.all(['#stat-submit', '#stat-cpuframe'].map(selector => page.locator(selector).innerText()))).some(value => !/non mesur|--|—/i.test(value));
    if (measured) {
      const chart = page.locator('#canvas-chart');
      const chartPixels = await pixels(chart);
      assert.ok(chartPixels.spread > 30, `02 a des métriques, mais son graphe est vide (écart ${chartPixels.spread})`);
    }
    await page.locator('[data-execution-view="completed"],[data-execution-view="error"],[data-execution-view="stopped"]').first().waitFor({ timeout: 120_000 });
    await page.waitForFunction(() => document.querySelectorAll('canvas').length === 0, null, { timeout: 5_000 });
    const terminalCanvases = await page.locator('canvas').evaluateAll(nodes => nodes.map(node => ({ id: node.id, scene: node.dataset.benchScene, display: getComputedStyle(node).display })));
    assert.deepEqual(terminalCanvases, [], `02 conserve un canvas après le terminal: ${JSON.stringify(terminalCanvases)}`);
    if (await page.locator('[data-execution-view="error"]').count()) {
      const chartText = await page.getByRole('region', { name: 'Graphe du test' }).innerText();
      assert.match(chartText, /WebGPU|indisponible|absent/i, '02 masque l’indisponibilité du benchmark réel dans le graphe');
      assert.equal(await page.locator('[data-campaign-sidebar="completed"]').count(), 0, '02 présente une campagne indisponible comme terminée');
      console.log('02: WebGPU indisponible, erreur explicite et aucune campagne mesurée');
    } else {
      assert.equal(measured, true, '02 termine sans métrique réelle');
      assert.equal(await page.locator('[data-campaign-sidebar="completed"]').count(), 1, '02 ne présente pas le rapport de la campagne mesurée');
      const summary = await page.locator('[data-campaign-sidebar="completed"]').innerText();
      assert.match(summary.replace(/\D/g, ''), new RegExp(instanceCount), `02 rapport incohérent pour ${instanceCount}`);
      console.log('02: campagne WebGPU mesurée, métriques et graphe non vide');
    }
  };

  await page.goto(`${origin}/?test=02-gpu-frustum-culling`);
  await page.locator('#sidebar').waitFor();
  await open02();

  if (webgpuChrome) {
    for (const instanceCount of ['500', '1000', '5000', '10000', '50000']) {
      await page.getByRole('button', { name: 'Nouvelle exécution', exact: true }).click();
      await page.locator('[data-execution-view="idle"]').waitFor();
      await open02(instanceCount);
    }
  }

  await page.locator('#select-module').selectOption('01-indirect-draw');
  await page.locator('[data-execution-view="idle"]').waitFor();
  await page.locator('#select-module').selectOption('02-gpu-frustum-culling');
  await page.locator('[data-execution-view="idle"]').waitFor();
  await page.locator('#select-module').selectOption('03-gpu-scene');
  await page.locator('[data-execution-view="idle"]').waitFor();
  await open02();

  assert.deepEqual(errors, []);
  console.log('02: canvas absent au repos, loader, pixels non uniformes animés, nettoyage terminal et navigation validés');
} finally {
  await browser.close();
}
