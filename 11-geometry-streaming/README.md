# 11-geometry-streaming — Résidence VRAM & Cycle de Pression Mémoire

## 1. Question Gouvernante
> *Comment garantir un chargement asynchrone par morceaux sous contrainte stricte de budget VRAM sans saccade ?*

---

## 2. Statut & Décision R&D
- **Statut :** gestionnaire contractuel et campagne déterministe exécutables ; chargeur GPU à brancher dans le runner navigateur commun
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Cycle de vie : Cold → Loading → Partially Resident → Fully Resident → Eviction → Re-request.

---

## 4. Structure du Banc
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `runner/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.

## 5. Ce que le banc exécute

`implementation/streamingLifecycle.ts` sépare requête, génération, publication, résolution de coupe et éviction. Une complétion d'une ancienne génération est ignorée. Une page fine absente sélectionne sa page de repli résidente afin de conserver une coupe complète. Les pages épinglées ne sont pas évincées et le nombre d'octets de payload logiquement résident ne dépasse pas le budget.

La campagne publie sa progression par frame et accepte une annulation. `logicalResidentBytes` décrit les payloads gérés par le banc ; ce n'est pas une mesure du pilote. RAM, VRAM, temps d'upload GPU et temps de frame restent `null` sans instrumentation physique.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
