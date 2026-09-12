/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "500",
    "title": "500 objets uniques",
    "disabled": false
  },
  {
    "id": "1000",
    "title": "1 000 objets uniques",
    "disabled": false
  },
  {
    "id": "2000",
    "title": "⚡ 2 000 objets (Coude)",
    "disabled": false
  },
  {
    "id": "5000",
    "title": "5 000 objets uniques",
    "disabled": false
  },
  {
    "id": "10000",
    "title": "🔥 10 000 objets",
    "disabled": false
  },
  {
    "id": "25000",
    "title": "🔥 25 000 objets",
    "disabled": false
  },
  {
    "id": "50000",
    "title": "☠️ 50 000 objets",
    "disabled": false
  },
  {
    "id": "100000",
    "title": "☠️ 100 000 objets",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
