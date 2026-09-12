import assert from 'node:assert/strict';
import { manifest as publicManifest } from '../index.ts';
import test from 'node:test';
import { manifest } from '../manifest.ts';
import { checkContract } from '../../test/benchStructure.ts';
test('08-occlusion-culling public contract', () => checkContract(manifest));
test('08-occlusion-culling public entry loads without a browser', () => assert.strictEqual(publicManifest, manifest));
