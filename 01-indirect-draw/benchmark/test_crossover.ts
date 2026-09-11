import { generateTestInstances, createBaseGeometry } from '../common/sceneGenerator.ts';
import { GpuSceneBuffer, FLOATS_PER_INSTANCE } from '../implementation/gpuSceneBuffer.ts';

export function runIndirectSuite() {
  console.log('--- TEST 1: Génération déterministe des instances ---');
  const instances500 = generateTestInstances(500, 42);
  const instances2000 = generateTestInstances(2000, 42);
  console.log(`Tiers générés : 500 instances -> ${instances500.length}, 2000 instances -> ${instances2000.length}`);

  if (instances500.length !== 500 || instances2000.length !== 2000) {
    throw new Error('Erreur de comptage des instances');
  }

  console.log('--- TEST 2: Validation du packing des buffers GPU ---');
  const geom = createBaseGeometry();
  const sceneBuffer = new GpuSceneBuffer(instances2000, geom);

  console.log(`Taille instanceData : ${sceneBuffer.instanceData.length} floats (${sceneBuffer.instanceData.byteLength} octets)`);
  console.log(`Floats attendus : ${2000 * FLOATS_PER_INSTANCE} = ${sceneBuffer.instanceData.length}`);
  console.log(`Indirect data initial :`, Array.from(sceneBuffer.indirectData));

  if (sceneBuffer.instanceData.length !== 2000 * FLOATS_PER_INSTANCE) {
    throw new Error('Erreur de taille de buffer GPU');
  }
  if (sceneBuffer.indirectData[0] !== geom.index!.count) {
    throw new Error(`indexCount attendu ${geom.index!.count}, reçu ${sceneBuffer.indirectData[0]}`);
  }
  if (sceneBuffer.indirectData[1] !== 0) {
    throw new Error('instanceCount indirect initial doit être 0');
  }

  console.log('Tests CPU 01-indirect-draw réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runIndirectSuite();
}
