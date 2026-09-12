import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('06-meshlet-culling canonical structure', () => checkStructure('06-meshlet-culling'));
test('06-meshlet-culling public dependencies', () => checkImports('06-meshlet-culling', '06-meshlet-culling'));
