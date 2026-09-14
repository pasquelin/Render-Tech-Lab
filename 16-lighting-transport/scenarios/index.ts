export const scenarios = [
  { id: 'two-rooms', title: 'Deux pièces · trois sources colorées', disabled: false },
  { id: 'delayed-indirect-response', title: 'Retard de réponse lumineuse', disabled: false },
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
