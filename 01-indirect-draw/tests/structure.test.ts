import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('01-indirect-draw canonical structure', () => checkStructure('01-indirect-draw'));
test('01-indirect-draw public dependencies', () => checkImports('01-indirect-draw', '01-indirect-draw'));
