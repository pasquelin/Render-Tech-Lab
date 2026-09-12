import { createIntegratedRunner } from '../shared/benchmark/integratedRunners.ts';

const test = process.argv.find(argument => argument.startsWith('--test='))?.slice(7);
if (!['06-meshlet-culling', '07-hiz'].includes(test)) throw new Error('Oracle CPU attendu: 06-meshlet-culling ou 07-hiz');
const result = await createIntegratedRunner(test).run({ samples: 12, warmup: 8 });
if (result.status !== 'measured' || !result.gates.correctness || result.records.some(record => record.gpuMs !== null)) {
  throw new Error(`Échec oracle CPU: ${JSON.stringify(result)}`);
}
console.log(JSON.stringify({ execution: 'cpu-oracle', gpuExecuted: false, result }, null, 2));
