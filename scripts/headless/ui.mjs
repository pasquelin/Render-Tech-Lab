import { openLabPage } from './lib.mjs';
const { browser, page } = await openLabPage({ path: '/?test=15-virtualized-integration', viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });
page.on('pageerror', e => errors.push('PAGEERROR ' + (e.stack || e.message).slice(0, 600)));
await page.waitForTimeout(1500);
const selects = await page.locator('select').all();
for (const s of selects) { const opts = await s.locator('option').allTextContents(); if (opts.some(t => /WebGPU/i.test(t))) { await s.selectOption({ label: opts.find(t => /WebGPU/i.test(t)) }); console.log('select ->', opts.find(t => /WebGPU/i.test(t))); break; } }
const btn = page.locator('button', { hasText: /Lancer|Démarrer|Explorer|exploration|Start/i }).first();
console.log('bouton:', await btn.textContent());
await btn.click();
await page.waitForTimeout(8000);
{ const selects = await page.locator('select').all();
  for (const s of selects) { const opts = await s.locator('option').allTextContents(); if (opts.some(t => /WebGPU/i.test(t))) { await s.selectOption({ label: opts.find(t => /WebGPU/i.test(t)) }); console.log('switch ->', opts.find(t => /WebGPU/i.test(t))); break; } } }
for (let i = 0; i < 40; i++) { await page.waitForTimeout(1000); const t = await page.locator('body').innerText(); const m = t.match(/Chargement interrompu[^\n]*|Moteur affiché : [^\n]*|Rapport archivé[^\n]*/g); if (m && m.some(x => /interrompu|archivé/.test(x))) { console.log('STATUS', m.join(' | ')); break; } if (i === 39) console.log('STATUS (fin)', (m ?? []).join(' | ')); }
const t = await page.locator('body').innerText(); const fps = t.match(/FPS\n[\d,.]+ FPS/g); console.log('metrics:', (t.match(/Triangles sélectionnés\n[\d ]+/g) ?? []).join(' ; '), fps ?? '');
console.log('errors:', errors.slice(0, 6).join('\n'));
await browser.close();
