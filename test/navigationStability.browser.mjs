import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const origin = process.env.LAB_URL ?? 'http://localhost:5174';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(`${origin}/?test=00-baseline`);
  await page.locator('header').evaluate(node => { node.dataset.stableShell = 'same-node'; });
  const rect = () => page.evaluate(() => Object.fromEntries(['header', '[data-lab-main]', '#sidebar', '#viewport-container'].map(selector => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return [selector, [box.x, box.y, box.width, box.height]];
  })));
  const baseline = await rect();
  for (const moduleId of ['01-indirect-draw', '03-gpu-scene', '14-open-world', '01-indirect-draw', '15-virtualized-integration', '01-indirect-draw', '00-baseline']) {
    const samples = await page.evaluate(async id => {
      const select = document.querySelector('#select-module');
      select.value = id; select.dispatchEvent(new Event('change', { bubbles: true }));
      const values = [];
      for (let frame = 0; frame < 4; frame++) {
        await new Promise(requestAnimationFrame);
        const header = document.querySelector('header').getBoundingClientRect();
        const content = document.querySelector('[data-lab-main]').getBoundingClientRect();
        const sidebar = document.querySelector('#sidebar').getBoundingClientRect();
        values.push([header.x, header.y, header.width, header.height, content.x, content.width, sidebar.x, sidebar.width]);
      }
      return values;
    }, moduleId);
    await page.waitForFunction(id => document.querySelector('#select-module')?.value === id, moduleId);
    assert.equal(await page.locator('header').getAttribute('data-stable-shell'), 'same-node', `${moduleId}: shell remounted`);
    for (const sample of samples) sample.forEach((value, index) => assert.ok(Math.abs(value - samples[0][index]) <= 1, `${moduleId}: frame ${index} shifted`));
    const current = await rect();
    for (const selector of ['header', '[data-lab-main]', '#sidebar']) current[selector].forEach((value, index) => assert.ok(Math.abs(value - baseline[selector][index]) <= 1, `${moduleId}: ${selector}[${index}] shifted`));
  }
  const motion = await page.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, transition: getComputedStyle(document.querySelector('.btn')).transitionDuration }));
  assert.equal(motion.reduced, true);
  assert.ok(parseFloat(motion.transition) <= 0.01);
} finally { await browser.close(); }
