/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "S0",
    "title": "S0 · 1 objet témoin",
    "disabled": false
  },
  {
    "id": "S1",
    "title": "S1 · 500 instanciés",
    "disabled": false
  },
  {
    "id": "S2",
    "title": "S2 · 1 000 instanciés",
    "disabled": false
  },
  {
    "id": "S3",
    "title": "S3 · 2 000 uniques (Coude)",
    "disabled": false
  },
  {
    "id": "S4",
    "title": "S4 · 30 lumières dynamiques",
    "disabled": false
  },
  {
    "id": "S5",
    "title": "S5 · 5 000 hostile (Chute)",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
