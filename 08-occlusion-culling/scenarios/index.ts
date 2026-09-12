/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "2000-50",
    "title": "⚡ 2 000 objets (50% occlus)",
    "disabled": false
  },
  {
    "id": "5000-75",
    "title": "5 000 objets (75% occlus)",
    "disabled": false
  },
  {
    "id": "10000-90",
    "title": "🔥 10 000 objets (90% occlus)",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
