export const scenarios = [
  { id: 'two-rooms', title: 'Deux pièces · trois sources colorées', disabled: false },
] as const;
export const scenarioIds = scenarios.map(scenario => scenario.id);
