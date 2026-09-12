import test from 'node:test';
import { checkStructure, checkImports } from '../../test/benchStructure.ts';
test('07-hiz canonical structure', () => checkStructure('07-hiz'));
test('07-hiz public dependencies', () => checkImports('07-hiz', '07-hiz'));
