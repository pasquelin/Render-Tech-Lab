/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "1080p",
    "title": "⚡ Résolution 1080p (FHD)",
    "disabled": false
  },
  {
    "id": "1440p",
    "title": "Résolution 1440p (2K)",
    "disabled": false
  },
  {
    "id": "4k",
    "title": "🔥 Résolution 4K (Ultra-HD)",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
