import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('14-open-world canonical structure', () => checkStructure('14-open-world'));
test('14-open-world public dependencies', () => checkImports('14-open-world', '14-open-world'));
