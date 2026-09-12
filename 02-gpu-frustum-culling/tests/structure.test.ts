import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('02-gpu-frustum-culling canonical structure', () => checkStructure('02-gpu-frustum-culling'));
test('02-gpu-frustum-culling public dependencies', () => checkImports('02-gpu-frustum-culling', '02-gpu-frustum-culling'));
