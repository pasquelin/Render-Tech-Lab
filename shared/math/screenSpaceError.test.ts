/**
 * shared/math/screenSpaceError.test.ts
 *
 * Banc de tests unitaires pour la formule Screen-Space Error (SSE).
 * Exécutable via Node/TypeScript sans navigateur.
 */

import {
  calculateScreenSpacePixels,
  evaluateLodTier,
  calculateProjectedGeometricError,
  isGeometricErrorAcceptable,
  DEFAULT_LOD_THRESHOLDS,
  CONTRACTUAL_MAX_ERROR_PX,
} from './screenSpaceError.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Échec d'assertion : ${message}`);
  }
}

function runTests() {
  console.log('🧪 Exécution des tests unitaires Screen-Space Error (SSE)...');

  const screenHeight = 1080;
  const fovRad = (60 * Math.PI) / 180; // FOV vertical standard de 60 degrés
  const objectDiameter = 2.0; // Objet de 2 mètres (sphère rayon 1m)

  // 1. Décroissance mathématique inversement proportionnelle à la distance
  const px1m = calculateScreenSpacePixels(objectDiameter, 1.0, screenHeight, fovRad);
  const px2m = calculateScreenSpacePixels(objectDiameter, 2.0, screenHeight, fovRad);
  const px10m = calculateScreenSpacePixels(objectDiameter, 10.0, screenHeight, fovRad);
  const px100m = calculateScreenSpacePixels(objectDiameter, 100.0, screenHeight, fovRad);

  console.log(`  Distance 1m   : ${px1m.toFixed(1)} px`);
  console.log(`  Distance 2m   : ${px2m.toFixed(1)} px`);
  console.log(`  Distance 10m  : ${px10m.toFixed(1)} px`);
  console.log(`  Distance 100m : ${px100m.toFixed(1)} px`);

  // Propriété fondamentale : à distance double, la taille en pixels est exactement divisée par 2
  assert(Math.abs(px1m - px2m * 2) < 0.001, 'Doublement de distance doit diviser la taille par 2');
  assert(Math.abs(px1m - px10m * 10) < 0.001, 'Distance x10 doit diviser la taille par 10');
  assert(Math.abs(px1m - px100m * 100) < 0.001, 'Distance x100 doit diviser la taille par 100');

  // 2. Vérification des frontières de sélection de LOD
  // Seuil LOD0 = 250 px, Seuil LOD1 = 60 px
  assert(evaluateLodTier(300, DEFAULT_LOD_THRESHOLDS) === 0, '300 px > 250 px doit sélectionner LOD 0');
  assert(evaluateLodTier(250.1, DEFAULT_LOD_THRESHOLDS) === 0, '250.1 px > 250 px doit sélectionner LOD 0');
  assert(evaluateLodTier(250.0, DEFAULT_LOD_THRESHOLDS) === 1, '250.0 px <= 250 px doit basculer vers LOD 1');
  assert(evaluateLodTier(150, DEFAULT_LOD_THRESHOLDS) === 1, '150 px doit sélectionner LOD 1');
  assert(evaluateLodTier(60.1, DEFAULT_LOD_THRESHOLDS) === 1, '60.1 px doit sélectionner LOD 1');
  assert(evaluateLodTier(60.0, DEFAULT_LOD_THRESHOLDS) === 2, '60.0 px doit basculer vers LOD 2');
  assert(evaluateLodTier(25, DEFAULT_LOD_THRESHOLDS) === 2, '25 px doit sélectionner LOD 2');
  assert(evaluateLodTier(0, DEFAULT_LOD_THRESHOLDS) === 2, '0 px doit sélectionner LOD 2');

  // 3. Validation de l'erreur géométrique projetée et du seuil contractuel (1.5 px)
  // Supposons une simplification générant une déviation maximale de 0.01 mètre (1 cm)
  const geomError1cm = 0.01;
  const projErrorAt2m = calculateProjectedGeometricError(geomError1cm, 2.0, screenHeight, fovRad);
  const projErrorAt10m = calculateProjectedGeometricError(geomError1cm, 10.0, screenHeight, fovRad);

  console.log(`  Erreur 1cm à 2m  : ${projErrorAt2m.toFixed(2)} px (seuil <= ${CONTRACTUAL_MAX_ERROR_PX} px)`);
  console.log(`  Erreur 1cm à 10m : ${projErrorAt10m.toFixed(2)} px`);

  assert(isGeometricErrorAcceptable(1.2), 'Erreur de 1.2 px doit être acceptée (<= 1.5 px)');
  assert(isGeometricErrorAcceptable(1.5), 'Erreur limite de 1.5 px doit être acceptée');
  assert(!isGeometricErrorAcceptable(1.51), 'Erreur de 1.51 px doit être rejetée (> 1.5 px)');
  assert(!isGeometricErrorAcceptable(4.0), 'Erreur de 4.0 px doit être rejetée');

  // 4. Cas limites (robustesse numérique)
  assert(calculateScreenSpacePixels(objectDiameter, 0, screenHeight, fovRad) === Infinity, 'Distance nulle doit retourner Infinity');
  assert(calculateScreenSpacePixels(0, 10, screenHeight, fovRad) === 0, 'Diamètre nul doit retourner 0');
  assert(calculateScreenSpacePixels(objectDiameter, 10, 0, fovRad) === 0, 'Hauteur écran nulle doit retourner 0');

  console.log('✅ Tous les tests unitaires mathématiques SSE sont validés avec succès !');
}

runTests();
