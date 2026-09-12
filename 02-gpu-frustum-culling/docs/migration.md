# Migration

Public consumers use `index.ts` or metadata-only `manifest.ts`. Contracts live in `contracts.ts`; runner sources live in `runner/`. All active consumers now target canonical source paths; compatibility forwarding modules have been removed. HTML routes, public assets and existing result files are retained. `results/` remains the original archive authority; no historical metric is rewritten by this migration.
