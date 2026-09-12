import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('15-virtualized-integration canonical structure', () => checkStructure('15-virtualized-integration'));
test('15-virtualized-integration public dependencies', () => checkImports('15-virtualized-integration', '15-virtualized-integration'));
