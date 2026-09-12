/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "512",
    "title": "512×512",
    "disabled": false
  },
  {
    "id": "1024",
    "title": "1024×1024",
    "disabled": false
  },
  {
    "id": "2048",
    "title": "2048×2048",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
