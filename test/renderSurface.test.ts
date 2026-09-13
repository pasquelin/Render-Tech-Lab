import test from 'node:test';
import assert from 'node:assert/strict';
import { clearColorFromCss, resolveSurfaceClearColor, surfaceThemeColor } from '../src/lab/renderSurface.ts';

test('a host surface resolves its CSS clear color without a renderer-owned palette', () => {
  assert.equal(clearColorFromCss('rgb(45, 64, 89)'), 0x2d4059);
  assert.equal(clearColorFromCss('rgb(45 64 89 / 1)'), 0x2d4059);
  assert.equal(clearColorFromCss('oklch(0.35 0.05 260)', () => [45, 64, 89]), 0x2d4059);
});

test('an unsupported surface color is rejected instead of silently choosing a renderer color', () => {
  assert.throws(() => clearColorFromCss('transparent'), /Couleur de fond/);
});

test('the Lab uses its theme token instead of a canvas implementation background', () => {
  assert.equal(surfaceThemeColor('oklch(30.857% 0.023 264.149)', 'rgb(0, 0, 0)'), 'oklch(30.857% 0.023 264.149)');
});

test('the color diagnostic keeps the CSS sources and the exact renderer input', () => {
  assert.deepEqual(
    resolveSurfaceClearColor('oklch(30.857% 0.023 264.149)', 'rgb(0, 0, 0)', () => [45, 64, 89]),
    { source: 'theme', themeColor: 'oklch(30.857% 0.023 264.149)', computedBackground: 'rgb(0, 0, 0)', value: 0x2d4059, hex: '#2d4059' },
  );
});
