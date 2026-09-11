# Bench Report: 02-gpu-scene

**Technique under test:** Heterogeneous GPU Scene (`ObjectBuffer`, `GeometryBuffer`, `MaterialBuffer`, Multi-Draw Indirect)
**Status:** aucune mesure enregistrée

> **Governing rule:** ce fichier est généré par le banc (`02-gpu-scene/benchmark/reporter.ts`).
> Il n'est jamais rédigé à la main : un rapport doit être reproductible à partir d'une campagne.

---

## Aucune mesure enregistrée

Lancez la campagne depuis le banc — « Matrice 4D Complète » ou « Stress Topologies » — pour
générer ce rapport à partir de mesures réelles.

La version précédente de ce fichier a été retirée : elle publiait des valeurs
(temps de culling GPU, compteurs d'objets culled, palier « 1 topology ») que le
harnais ne produisait pas — il n'existe aucune timestamp query dans le module et
les compteurs de visibilité n'étaient pas relus depuis la VRAM.
