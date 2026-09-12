import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('03-gpu-scene canonical structure', () => checkStructure('03-gpu-scene'));
test('03-gpu-scene public dependencies', () => checkImports('03-gpu-scene', '03-gpu-scene'));
