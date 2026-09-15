import type { ModelConfig } from './modelCampaign.ts';

/** Les trois déplacements que le Lab sait construire sur une scène ouverte. Un seul endroit les
 *  nomme et les explique : le banc 15 et le banc 16 rendent le même sélecteur, avec les mêmes
 *  libellés et la même aide, sans qu'aucun des deux recopie le texte de l'autre. */
export type LabCameraMode = ModelConfig['camera'];

export const LAB_CAMERA_MODES: ReadonlyArray<{ readonly value: LabCameraMode; readonly label: string; readonly help: string }> = [
  { value: 'orbit', label: 'Orbite', help: 'Glisser pour tourner, molette pour zoomer, clic droit pour translater.' },
  { value: 'free', label: 'Libre à pied', help: 'Cliquer dans la vue, W/A/S/D : marcher, R/F : altitude, glisser : regarder. L’horizon reste stable.' },
  { value: 'game', label: 'Jeu à la première personne', help: 'Cliquer dans la vue pour capturer la souris. W/A/S/D : avancer ; Espace : sauter ; Maj : courir ; Échap : libérer la souris.' },
];

export function cameraModeHelp(mode: LabCameraMode): string {
  return LAB_CAMERA_MODES.find(entry => entry.value === mode)?.help ?? '';
}
