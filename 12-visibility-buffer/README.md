# 12-visibility-buffer — Architecture de Visibilité & Shading Différé

## 1. Question Gouvernante
> *Le découplage strict entre calcul de visibilité et shading différé apporte-t-il un gain net sur WebGPU face aux scènes denses ?*

---

## 2. Statut & Décision R&D
- **Statut :** contrat d'identité, reconstruction et campagne à deux passes exécutables ; backend WebGPU à brancher dans le runner navigateur commun
- **Arbitrage cible :** `INTEGRATE` / `REJECT` / `WATCHLIST`

---

## 3. Périmètre Expérimental
Passes : Passe 1 (visibilité 32-bit compacte), Passe 2 (reconstruction et shading différé).

---

## 4. Structure du Banc
- `implementation/` : Code source expérimental WebGPU / WGSL.
- `runner/` : Profilage et banc d'essai automatisé.
- `results/` : Métriques contractuelles `latest.json` et rapport `REPORT.md`.

## 5. Ce que le banc exécute

L'identifiant zéro est réservé au fond. Les couples instance/primitive sont encodés sans ambiguïté, puis les attributs et la profondeur sont reconstruits depuis le triangle gagnant. La campagne valide les readbacks d'IDs et de profondeur avant d'accepter un échantillon et conserve séparément le temps de visibilité, le temps de shading, le lookup matériau et la référence forward.

Les durées restent `null` lorsque l'exécuteur matériel ne dispose pas de timestamps ou ne mesure pas la phase concernée.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
