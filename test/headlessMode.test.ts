import test from 'node:test';
import assert from 'node:assert/strict';
import { modeFromEnv, truthReport } from '../scripts/headless/lib.mjs';

test('HEADLESS=0 consigne le mode visible dans le rapport, tout le reste garde le mode headless', () => {
  assert.equal(modeFromEnv({}), 'headless');
  assert.equal(modeFromEnv({ HEADLESS: '1' }), 'headless');
  assert.equal(modeFromEnv({ HEADLESS: 'false' }), 'headless');
  assert.equal(modeFromEnv({ HEADLESS: '0' }), 'visible');
});

test('ceilingIntervalsMs calibre le plafond sur toute la série rAF, pas sur le seul minimum de chaque passe', async () => {
  // Un relevé visible réaliste (90 images à ~8,3 ms) avec une image isolée plus rapide (jitter) :
  // le minimum seul snaperait ailleurs qu'à 120 Hz, la série complète s'y accroche.
  const visible = Array.from({ length: 90 }, () => 8.3);
  visible[5] = 5.7;
  const withFullSeries = await truthReport({
    scene: 'low-poly-city', engines: ['exact-cluster-pages'], engineOrder: 'abba',
    passes: [], id: 't-ceiling-full', ceilingIntervalsMs: visible,
  });
  assert.equal(withFullSeries.refreshCeiling.hz, 120);

  const withoutSeries = await truthReport({
    scene: 'low-poly-city', engines: ['exact-cluster-pages'], engineOrder: 'abba',
    passes: [], id: 't-ceiling-empty',
  });
  assert.equal(withoutSeries.refreshCeiling.hz, null);
});
