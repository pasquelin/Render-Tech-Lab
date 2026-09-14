import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const origin = process.env.LAB_URL ?? 'http://localhost:5174';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(`${origin}/?test=00-baseline`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  assert.equal(await page.locator('canvas').count(), 0);
  assert.doesNotMatch(await page.locator('main').innerText(), /Aucune campagne mesurée|Configuration interne|Mesures de référence/);
  const ids = await page.locator('[data-bench-access]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-bench-access')));
  assert.deepEqual(ids.map(id => id.slice(0, 2)), Array.from({ length: 16 }, (_, index) => String(index + 1).padStart(2, '0')));
  assert.equal(await page.locator('[data-bench-access="15-full-pipeline"]').count(), 0);
  const cardHeights = await page.locator('[data-bench-access]').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().height)));
  assert.equal(new Set(cardHeights).size, 1, `Hauteurs des accès incohérentes : ${cardHeights.join(', ')}`);
  for (const id of ids) {
    console.log(`Navigation Dashboard → ${id}`);
    await page.goto(`${origin}/?test=00-baseline`);
    const card = page.locator(`[data-bench-access="${id}"]`);
    assert.ok(await card.getAttribute('title'));
    await card.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(expected => document.querySelector('#select-module')?.value === expected, id);
    await page.locator('#select-module').selectOption('00-baseline');
    await page.waitForFunction(() => document.querySelector('#select-module')?.value === '00-baseline');
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
    assert.equal(await page.locator('[data-bench-access]').count(), 16);
  }
  await page.screenshot({ path: '/tmp/baseline-navigation.png', fullPage: true });
} finally {
  await browser.close();
}
