/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "cone-50",
    "title": "Fixture moitié dos",
    "disabled": false
  },
  {
    "id": "backface-100",
    "title": "Fixture tous dos",
    "disabled": false
  },
  {
    "id": "frontface-0",
    "title": "Fixture tous face",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
