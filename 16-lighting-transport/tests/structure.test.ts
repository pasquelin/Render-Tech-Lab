import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';

test('16-lighting-transport canonical structure', () => checkStructure('16-lighting-transport'));
test('16-lighting-transport public dependencies', () => checkImports('16-lighting-transport', '16-lighting-transport'));
