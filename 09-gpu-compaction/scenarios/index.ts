/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "50000",
    "title": "50 000 instances",
    "disabled": false
  },
  {
    "id": "100000",
    "title": "⚡ 100 000 instances (Prefix-sum)",
    "disabled": false
  },
  {
    "id": "250000",
    "title": "🔥 250 000 instances (Massif)",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
