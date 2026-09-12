/**
 * 11-geometry-streaming/tests/test_streaming.ts
 *
 * Banc de test et simulation de cycle de vie pour 11-geometry-streaming.
 * Valide les 6 états contractuels : cold -> loading -> partially-resident -> fully-resident -> eviction -> re-request.
 */

import {
  GeometryStreamingManager,
} from '../implementation/streamingLifecycle.ts';
import type { StreamingLifecycle } from '../contracts.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[11-geometry-streaming] Échec d'assertion : ${message}`);
  }
}

export function runStreamingSuite() {
  console.log('🚀 Lancement du banc 11-geometry-streaming (Cycle de vie VRAM & LRU)...');

  // Budget VRAM contractuel : 4 Mo
  // Pages : 20 pages géométriques de 512 Ko chacune (taille totale disponible : 10 Mo)
  const pageSizeBytes = 512 * 1024; // 512 Ko par page
  const vramBudgetBytes = 4 * 1024 * 1024; // 4 Mo (max 8 pages simultanées en VRAM)

  const manager = new GeometryStreamingManager(
    { requestedFraction: 50, vramBudgetBytes },
    2 * 1024 * 1024 // 2 Mo d'upload max par frame
  );

  const pageDefs = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    sizeBytes: pageSizeBytes,
    fallbackPageId: null,
    pinned: false,
  }));
  manager.registerPages(pageDefs);

  assert(manager.pages.size === 20, '20 pages géométriques doivent être enregistrées');
  assert(manager.residentBytes === 0, 'La VRAM résidente initiale doit être nulle (cold)');

  const frameLogs: { frame: number; description: string; lifecycle: StreamingLifecycle }[] = [];

  // FRAME 1 : Chargement initial cold -> 4 pages demandées (2 Mo)
  const f1 = manager.processFrame([0, 1, 2, 3]);
  console.log(
    `  Frame 1 : Requête [0..3] -> Résident: ${(f1.metrics.residentBytes! / 1024).toFixed(0)} Ko | Upload: ${(f1.metrics.uploadedBytes! / 1024).toFixed(0)} Ko | Éviction: ${f1.metrics.evictedBytes} o | État: ${f1.state}`
  );
  frameLogs.push({ frame: 1, description: 'Chargement initial (2 Mo)', lifecycle: f1 });
  assert(f1.metrics.residentBytes === 2 * 1024 * 1024, '2 Mo doivent être résidents');

  // FRAME 2 : Expansion jusqu'à saturation du budget (pages 0..7 = 4 Mo)
  const f2 = manager.processFrame([0, 1, 2, 3, 4, 5, 6, 7]);
  console.log(
    `  Frame 2 : Requête [0..7] -> Résident: ${(f2.metrics.residentBytes! / 1024).toFixed(0)} Ko | Upload: ${(f2.metrics.uploadedBytes! / 1024).toFixed(0)} Ko | Éviction: ${f2.metrics.evictedBytes} o | État: ${f2.state}`
  );
  frameLogs.push({ frame: 2, description: 'Pleine saturation du budget (4 Mo)', lifecycle: f2 });
  assert(f2.metrics.residentBytes === vramBudgetBytes, 'Le budget doit être saturé à 4 Mo');

  // FRAME 3 : Mouvement de caméra vers un nouveau secteur (pages 8..11 = 2 Mo)
  // Dépassement de budget -> Déclenchement de l'éviction LRU des pages 0..3 !
  const f3 = manager.processFrame([4, 5, 6, 7, 8, 9, 10, 11]);
  console.log(
    `  Frame 3 : Requête nouveau secteur -> Résident: ${(f3.metrics.residentBytes! / 1024).toFixed(0)} Ko | Upload: ${(f3.metrics.uploadedBytes! / 1024).toFixed(0)} Ko | Éviction: ${(f3.metrics.evictedBytes! / 1024).toFixed(0)} Ko | État: ${f3.state}`
  );
  frameLogs.push({ frame: 3, description: 'Éviction LRU sous pression mémoire', lifecycle: f3 });
  assert(f3.metrics.evictedBytes! > 0, 'Une éviction LRU doit avoir eu lieu');
  assert(
    f3.metrics.residentBytes! <= vramBudgetBytes,
    'La VRAM résidente ne doit JAMAIS dépasser le budget contractuel'
  );

  // Vérification que les pages 0..3 sont bien en état d'éviction
  assert(manager.pages.get(0)!.state === 'eviction', 'La page 0 doit avoir été évincée (LRU)');

  // FRAME 4 : Re-request : la caméra retourne sur ses pas et redemande les pages 0..3
  const f4 = manager.processFrame([0, 1, 2, 3, 8, 9, 10, 11]);
  console.log(
    `  Frame 4 : Retour caméra (Re-request) -> Résident: ${(f4.metrics.residentBytes! / 1024).toFixed(0)} Ko | Upload: ${(f4.metrics.uploadedBytes! / 1024).toFixed(0)} Ko | Éviction: ${(f4.metrics.evictedBytes! / 1024).toFixed(0)} Ko | État: ${f4.state}`
  );
  frameLogs.push({ frame: 4, description: 'Re-request des pages évincées', lifecycle: f4 });
  assert(manager.pages.get(0)!.state === 'fully-resident', 'La page 0 doit être revenue résidente');
  assert(
    f4.metrics.residentBytes! <= vramBudgetBytes,
    'Le budget VRAM doit toujours être strictement respecté'
  );

  console.log('Tests CPU 11-geometry-streaming réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStreamingSuite();
}
