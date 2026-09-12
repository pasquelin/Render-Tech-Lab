import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const origin = process.env.LAB_URL ?? 'http://localhost:5174';
const browser = await chromium.launch({ channel: process.env.RTL_BROWSER_CHANNEL ?? 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(`${origin}/?test=15-virtualized-integration`);
  const preparationSignature = async () => page.locator('[data-execution-view="idle"] > section').evaluate(section => ({
    children: Array.from(section.children).map(child => child.tagName),
    headings: Array.from(section.querySelectorAll('h1,h2,h3')).map(node => node.textContent?.trim()),
    hasProtocol: Boolean(section.querySelector('[aria-label="Étapes attendues de la campagne"]')),
    hasActions: Boolean(section.querySelector('button')),
  }));
  const emeraldSignature = await preparationSignature();
  assert.equal(await page.locator('canvas').count(), 0, 'Emerald ne crée aucun canvas au repos');
  assert.deepEqual(await page.locator('[aria-label="Configuration de lancement"] [role="radiogroup"]').evaluateAll(nodes => nodes.map(node => node.id)), ['emerald-scene', 'emerald-mode', 'emerald-extent', 'emerald-detail', 'emerald-anisotropy']);
  assert.equal(await page.locator('#emerald-mode').count(), 1);
  await page.getByRole('radio', { name: 'Fixture procédurale' }).click();
  await page.getByRole('heading', { name: '15 · Pipeline de géométrie virtualisée' }).waitFor();
  const fixtureSignature = await preparationSignature();
  assert.deepEqual(fixtureSignature.children, emeraldSignature.children, 'les deux scènes gardent la même géométrie de fiche');
  assert.equal(fixtureSignature.hasProtocol, true);
  assert.equal(fixtureSignature.hasActions, true);
  const fixtureText = await page.locator('body').innerText();
  assert.doesNotMatch(fixtureText, /Commutez instantanément entre les pipelines|Mode unique|Aucune campagne mesurée disponible/);
  assert.doesNotMatch(fixtureText, /Explorez la ville réelle et observez les compteurs de navigation/);
  assert.deepEqual(await page.locator('[aria-label="Configuration de lancement"] [role="radiogroup"]').evaluateAll(nodes => nodes.map(node => node.id)), ['emerald-scene']);
  for (const id of ['emerald-mode', 'emerald-extent', 'emerald-detail', 'emerald-anisotropy']) {
    assert.equal(await page.locator(`#${id}`).count(), 0, `la fixture masque ${id}`);
  }
  assert.equal(await page.locator('canvas').count(), 0, 'la fixture ne crée aucun canvas au repos');
  assert.equal(await page.locator('#canvas-webgpu:visible').count(), 0);
  await page.locator('[data-execution-view="idle"] button').filter({ hasText: /Exécuter/ }).click();
  await page.locator('[data-algorithm-visualization="15-virtualized-integration"]').waitFor();
  for (let frame = 0; frame < 8; frame++) {
    assert.equal(await page.locator('#canvas-webgpu:visible').count(), 0);
    await page.waitForTimeout(120);
  }
  await page.locator('[data-execution-view="completed"]').waitFor({ timeout: 90000 });
  const report = page.locator('[data-execution-view="completed"]');
  for (const label of ['Résidence complète', 'Niveau de détail résident', 'Pression du streaming']) await report.getByText(label, { exact: true }).waitFor();
  assert.doesNotMatch(await report.innerText(), /(?:exact-resident|lod-resident|streaming-pressure):[AB]:\d/);
  for (const width of [1400, 520]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await report.evaluate(node => node.scrollWidth - node.clientWidth);
    assert.ok(overflow <= 1, `${width}px: horizontal overflow ${overflow}`);
  }
  await page.getByRole('link', { name: 'Ouvrir le Dashboard render-tech-lab' }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.locator('#select-module').selectOption('15-virtualized-integration');
  await page.getByRole('heading', { name: '15 · Pipeline de géométrie virtualisée' }).waitFor();
  await page.getByRole('radio', { name: 'Fixture procédurale' }).click();
  await page.locator('[data-execution-view="idle"] button').filter({ hasText: /Exécuter/ }).click();
  await page.locator('#btn-stop-campaign').waitFor({ state: 'attached' });
  await page.locator('#btn-stop-campaign').evaluate(button => button.click());
  await page.locator('[data-execution-view="stopped"]').waitFor({ timeout: 30000 });
  await page.locator('[data-execution-view="stopped"] button').filter({ hasText: /Exécuter|Relancer/ }).click();
  await page.locator('[data-algorithm-visualization="15-virtualized-integration"]').waitFor();
} finally { await browser.close(); }
