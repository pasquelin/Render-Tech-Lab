import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('09-gpu-compaction canonical structure', () => checkStructure('09-gpu-compaction'));
test('09-gpu-compaction public dependencies', () => checkImports('09-gpu-compaction', '09-gpu-compaction'));
