# 06-meshlet-culling — Cluster Culling & Taux de Rejet

## 1. Question Gouvernante
> *Quel volume géométrique précis est éliminé avant rasterisation par cluster culling, et quelle part revient à chaque test ?*

---

## 2. Statut & Décision R&D
- **Statut :** Oracle CPU et shader WGSL disponibles; invariants conservateurs validés. Exécution/timing GPU à brancher dans la coque commune.
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Métriques de rejet : global, frustum, backface cône, sub-pixel.

---

## 4. Structure du Banc
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `runner/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.

Le test local `node --experimental-strip-types 06-meshlet-culling/tests/test_meshlet_culling.ts`
vérifie séparément frustum, cône et sous-pixel, puis leur terminaison en chaîne. Aucun taux obtenu
par ce test CPU n'est publié comme mesure GPU.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
