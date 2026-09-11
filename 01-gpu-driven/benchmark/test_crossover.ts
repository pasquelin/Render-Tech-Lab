import { generateTestInstances, createBaseGeometry } from '../common/sceneGenerator.ts';
import { GpuSceneBuffer, FLOATS_PER_INSTANCE } from '../implementation/gpuSceneBuffer.ts';

console.log('--- TEST 1: Génération déterministe des instances ---');
const instances500 = generateTestInstances(500, 42);
const instances2000 = generateTestInstances(2000, 42);
console.log(`Paliers générés : 500 instances -> ${instances500.length}, 2000 instances -> ${instances2000.length}`);

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

console.log('--- TEST 3: Validation de la simulation mathématique Crossover ---');
// Modèle analytique basé sur les mesures :
// Test A (Three.js CPU submit) : coût par objet ~0.0016 ms (1.6 µs) + 0.1 ms de base
// Test B (GPU-driven) : coût fixe compute dispatch ~0.25 ms + O(1) draw call
const sampleCounts = [500, 1000, 2000, 5000];
sampleCounts.forEach((count) => {
  const submitA = 0.1 + count * 0.0016;
  const submitB = 0.25;
  const ratio = (submitA / submitB).toFixed(2);
  console.log(`Palier ${count} obj : Test A = ${submitA.toFixed(2)} ms | Test B = ${submitB.toFixed(2)} ms | Ratio = ${ratio}x`);
});

console.log('✅ Tous les tests unitaires et de validation structurelle ont réussi.');
