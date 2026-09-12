import assert from 'node:assert/strict';
import { manifest as publicManifest } from '../index.ts';
import test from 'node:test';
import { manifest } from '../manifest.ts';
import { checkContract } from '../../test/benchStructure.ts';
test('03-gpu-scene public contract', () => checkContract(manifest));
test('03-gpu-scene public entry loads without a browser', () => assert.strictEqual(publicManifest, manifest));
