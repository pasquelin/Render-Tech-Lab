import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('13-full-gpu-driven canonical structure', () => checkStructure('13-full-gpu-driven'));
test('13-full-gpu-driven public dependencies', () => checkImports('13-full-gpu-driven', '13-full-gpu-driven'));
