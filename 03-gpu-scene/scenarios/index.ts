/** Existing laboratory scenario identifiers; this list is not a validation verdict. */
export const scenarios = [
  {
    "id": "dim-a-10",
    "title": "⚡ Dim A · 10 topologies",
    "disabled": false
  },
  {
    "id": "dim-a-100",
    "title": "⚡ Dim A · 100 topologies",
    "disabled": false
  },
  {
    "id": "dim-b-10",
    "title": "⚡ Dim B · 10 matériaux",
    "disabled": false
  },
  {
    "id": "dim-b-100",
    "title": "⚡ Dim B · 100 matériaux",
    "disabled": false
  },
  {
    "id": "dim-c-25",
    "title": "⚡ Dim C · 25% dynamique",
    "disabled": false
  },
  {
    "id": "dim-c-50",
    "title": "⚡ Dim C · 50% dynamique",
    "disabled": false
  },
  {
    "id": "dim-c-100",
    "title": "🔥 Dim C · 100% dynamique",
    "disabled": false
  },
  {
    "id": "dim-d-50",
    "title": "⚡ Dim D · 50% visibilité",
    "disabled": false
  },
  {
    "id": "pain-500",
    "title": "🔥 Pain · 500 topologies",
    "disabled": false
  },
  {
    "id": "pain-1000",
    "title": "☠️ Torture · 1 000 topologies",
    "disabled": false
  }
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
