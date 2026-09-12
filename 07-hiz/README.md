# 07-hiz — Hi-Z Occlusion Depth Pyramid

## 1. Question Gouvernante
> *Quel est le coût matériel net (en ms GPU et bande passante VRAM) de la construction hiérarchique d'un tampon de profondeur sous WebGPU ?*

---

## 2. Statut & Décision R&D
- **Statut :** Oracle CPU exécutable et shader de réduction WGSL disponibles. Dispatch récursif et timestamps GPU à brancher dans la coque commune.
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Résolutions testées : 512², 1024², 2048².

---

## 4. Structure du Banc
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `runner/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.

Le test local `node --experimental-strip-types 07-hiz/tests/test_hiz.ts` couvre les tailles
impaires, la terminaison 1×1, standard-Z, reversed-Z et les requêtes invalides. Ses temps CPU ne
répondent pas à la question du coût GPU et ne sont donc pas publiés.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
