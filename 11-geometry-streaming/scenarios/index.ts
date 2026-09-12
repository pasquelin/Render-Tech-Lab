/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "32mb",
    "title": "Budget 32 MB (Contraint)",
    "disabled": false
  },
  {
    "id": "64mb",
    "title": "⚡ Budget 64 MB (LRU anneau)",
    "disabled": false
  },
  {
    "id": "128mb",
    "title": "Budget 128 MB (Étendu)",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
