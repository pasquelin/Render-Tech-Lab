import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('05-meshlets canonical structure', () => checkStructure('05-meshlets'));
test('05-meshlets public dependencies', () => checkImports('05-meshlets', '05-meshlets'));
