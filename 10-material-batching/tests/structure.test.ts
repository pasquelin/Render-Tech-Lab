import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('10-material-batching canonical structure', () => checkStructure('10-material-batching'));
test('10-material-batching public dependencies', () => checkImports('10-material-batching', '10-material-batching'));
