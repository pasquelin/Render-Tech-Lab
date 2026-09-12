import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('00-baseline canonical structure', () => checkStructure('00-baseline'));
test('00-baseline public dependencies', () => checkImports('00-baseline', '00-baseline'));
