/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "procedural-three-cases",
    "title": "Fixture procédurale",
    "disabled": false
  },
  {
    "id": "emerald-square",
    "title": "Emerald Square · ville réelle",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
