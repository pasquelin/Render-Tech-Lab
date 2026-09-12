/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "1000",
    "title": "1 000 objets · Multi-LOD",
    "disabled": false
  },
  {
    "id": "2000",
    "title": "⚡ 2 000 objets · Multi-LOD",
    "disabled": false
  },
  {
    "id": "5000",
    "title": "5 000 objets · Multi-LOD",
    "disabled": false
  },
  {
    "id": "10000",
    "title": "🔥 10 000 objets · Multi-LOD",
    "disabled": false
  },
  {
    "id": "50000",
    "title": "☠️ 50 000 objets · Multi-LOD",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
