/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "50",
    "title": "50 matériaux",
    "disabled": false
  },
  {
    "id": "100",
    "title": "⚡ 100 matériaux (1 draw call)",
    "disabled": false
  },
  {
    "id": "250",
    "title": "🔥 250 matériaux (Extrême)",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
