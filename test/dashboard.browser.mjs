import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const origin = process.env.LAB_URL ?? 'http://localhost:5175';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(`${origin}/?test=00-baseline`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  assert.equal(await page.locator('canvas').count(), 0);
  assert.equal(await page.locator('#btn-benchmark').count(), 0);
  assert.equal(await page.locator('[data-bench-access]').count(), 15);
  assert.equal(await page.locator('#dashboard-benches-card ul').evaluate(node => getComputedStyle(node).display), 'grid');
  assert.equal(await page.locator('#dashboard-benches-card ul').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 2);
  const widths = await page.locator('[data-bench-access]').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().width)));
  assert.equal(new Set(widths).size, 1, `Les accès n’ont pas la même largeur : ${widths.join(', ')}`);
  assert.equal(await page.locator('[data-bench-access="15-virtualized-integration"]').evaluate(node => Math.round(node.getBoundingClientRect().width)), widths[0]);
  assert.ok(await page.locator('main #dashboard-reports').getByText('Derniers rapports vérifiés').isVisible());
  assert.equal(await page.locator('#sidebar #dashboard-reports').count(), 0);
  assert.equal(await page.locator('main [data-bench-access]').count(), 0);
  await page.locator('main #dashboard-reports [aria-busy="false"]').waitFor();
  assert.equal(await page.locator('main #dashboard-reports li').count(), 15);
  const reportGrid = page.locator('main #dashboard-reports ul');
  assert.equal(await reportGrid.evaluate(node => getComputedStyle(node).display), 'grid');
  assert.equal(await reportGrid.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 2);
  const reportWidths = await page.locator('[data-dashboard-report]').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().width)));
  assert.equal(new Set(reportWidths).size, 1, `Les cartes rapport n’ont pas la même largeur : ${reportWidths.join(', ')}`);
  const reportHeights = await page.locator('[data-dashboard-report]').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().height)));
  assert.equal(new Set(reportHeights).size, 1, `Les cartes rapport n’ont pas la même hauteur : ${reportHeights.join(', ')}`);
  for (const selector of ['[data-report-title]', '[data-report-value]', '[data-report-meta]', '[data-report-provenance]']) {
    assert.equal(await page.locator(selector).evaluateAll(nodes => nodes.every(node => node.scrollHeight <= node.clientHeight + 1)), true, `${selector} utilise plus d’une ligne`);
  }
  assert.equal(await page.locator('[data-report-value]').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).whiteSpace === 'nowrap')), true);
  const reportGridWidth = await reportGrid.evaluate(node => node.getBoundingClientRect().width);
  assert.ok(reportWidths[0] > reportGridWidth * 0.45, `Les cartes ne remplissent pas leur cellule : ${reportWidths[0]} / ${reportGridWidth}`);
  const [reportsWidth, viewportWidth] = await page.locator('#dashboard-reports').evaluate(node => [node.getBoundingClientRect().width, node.parentElement?.getBoundingClientRect().width ?? 0]);
  assert.ok(reportsWidth > viewportWidth * 0.95, `Le panneau des rapports reste contraint : ${reportsWidth} / ${viewportWidth}`);
  assert.equal(await page.getByText('Aucun rapport vérifié').count() < 15, true, 'aucun rapport réel reconnu');
  for (const id of await page.locator('[data-bench-access]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-bench-access')))) {
    await page.goto(`${origin}/?test=00-baseline`);
    await page.locator(`[data-bench-access="${id}"]`).click();
    await page.waitForFunction(expected => document.querySelector('#select-module')?.value === expected, id);
    await page.locator('#select-module').selectOption('00-baseline');
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/?test=00-baseline`, { waitUntil: 'networkidle' });
  await page.locator('#dashboard-reports [aria-busy="false"]').waitFor();
  assert.equal(await page.locator('#dashboard-reports ul').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 1);
  assert.equal(await page.locator('#dashboard-benches-card ul').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 2);
  assert.equal(new Set(await page.locator('[data-dashboard-report]').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().height)))).size, 1);
  for (const selector of ['[data-report-title]', '[data-report-value]', '[data-report-meta]', '[data-report-provenance]']) {
    assert.equal(await page.locator(selector).evaluateAll(nodes => nodes.every(node => node.scrollHeight <= node.clientHeight + 1)), true, `${selector} utilise plus d’une ligne sur mobile`);
  }
  await page.screenshot({ path: '/tmp/dashboard-worktree.png', fullPage: true });
} finally {
  await browser.close();
}
