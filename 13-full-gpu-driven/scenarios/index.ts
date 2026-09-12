/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "50000",
    "title": "50 000 instances (19.2M tri)",
    "disabled": false
  },
  {
    "id": "100000",
    "title": "⚡ 100 000 objets (Pipeline complet)",
    "disabled": false
  },
  {
    "id": "200000",
    "title": "🔥 200 000 instances (Torture)",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
