/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "plane-1024",
    "title": "Sphère 1 024 triangles",
    "disabled": false
  },
  {
    "id": "sphere-4096",
    "title": "Sphère 4 096 triangles",
    "disabled": false
  },
  {
    "id": "bunny-16384",
    "title": "Sphère 16 384 triangles",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
