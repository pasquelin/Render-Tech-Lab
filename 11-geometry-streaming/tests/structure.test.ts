import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('11-geometry-streaming canonical structure', () => checkStructure('11-geometry-streaming'));
test('11-geometry-streaming public dependencies', () => checkImports('11-geometry-streaming', '11-geometry-streaming'));
