import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('12-visibility-buffer canonical structure', () => checkStructure('12-visibility-buffer'));
test('12-visibility-buffer public dependencies', () => checkImports('12-visibility-buffer', '12-visibility-buffer'));
