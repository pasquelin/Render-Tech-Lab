# 08-occlusion-culling — Occlusion Culling & Équation de Gain Net

## 1. Question Gouvernante
> *À partir de quel seuil d'occlusion le culling Hi-Z compense-t-il son propre surcoût de génération et de test ?*

---

## 2. Statut & Décision R&D
- **Statut :** Oracle CPU exécutable, seuil de confiance conservateur et équation nullable disponibles. Campagne WebGPU comparative à brancher dans la coque commune.
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Scénarios d'occlusion : 10%, 25%, 50%, 75%, 90%, 99%.

---

## 4. Structure du Banc
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `runner/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.

Le test local `node --experimental-strip-types 08-occlusion-culling/tests/test_occlusion.ts`
vérifie le classement visible/occlus, le seuil conservateur, les six paliers prévus et l'algèbre.
Il laisse coûts, gain et verdict à `null` tant que les quatre coûts physiques ne sont pas fournis.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
