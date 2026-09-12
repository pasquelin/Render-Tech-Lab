import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('08-occlusion-culling canonical structure', () => checkStructure('08-occlusion-culling'));
test('08-occlusion-culling public dependencies', () => checkImports('08-occlusion-culling', '08-occlusion-culling'));
