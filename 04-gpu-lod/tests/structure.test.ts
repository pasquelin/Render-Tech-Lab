import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('04-gpu-lod canonical structure', () => checkStructure('04-gpu-lod'));
test('04-gpu-lod public dependencies', () => checkImports('04-gpu-lod', '04-gpu-lod'));
