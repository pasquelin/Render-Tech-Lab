// Pilotage de l'interface réelle du Lab : lancement puis bascule de moteur.
// Usage : node ui.mjs
import { launch, URL_BASE } from './lib.mjs';

const { browser } = await launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });
page.on('pageerror', e => errors.push('PAGEERROR ' + (e.stack || e.message).slice(0, 600)));
await page.goto(URL_BASE + '/?test=15-virtualized-integration', { waitUntil: 'load' });
await page.waitForTimeout(1500);
const selectWebgpu = async () => {
  for (const select of await page.locator('select').all()) {
    const labels = await select.locator('option').allTextContents();
    const target = labels.find(text => /WebGPU/i.test(text));
    if (target) { await select.selectOption({ label: target }); console.log('select ->', target); return; }
  }
};
await selectWebgpu();
const button = page.locator('button', { hasText: /Lancer|Démarrer|Explorer|exploration|Start/i }).first();
console.log('bouton:', await button.textContent());
await button.click();
await page.waitForTimeout(8000);
await selectWebgpu();
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
  const text = await page.locator('body').innerText();
  const found = text.match(/Chargement interrompu[^\n]*|Moteur affiché : [^\n]*|Rapport archivé[^\n]*/g);
  if (found && found.some(line => /interrompu|archivé/.test(line))) { console.log('STATUS', found.join(' | ')); break; }
  if (i === 39) console.log('STATUS (fin)', (found ?? []).join(' | '));
}
const text = await page.locator('body').innerText();
console.log('metrics:', (text.match(/Triangles sélectionnés\n[\d ]+/g) ?? []).join(' ; '), text.match(/FPS\n[\d,.]+ FPS/g) ?? '');
console.log('errors:', errors.slice(0, 6).join('\n'));
await browser.close();
