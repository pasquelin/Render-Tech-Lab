import { SCENES } from '../contracts.ts';

export const scenarios = SCENES.map(scene => ({ id: scene.id, title: scene.title, disabled: false }));
export const scenarioIds = scenarios.map(scenario => scenario.id);
