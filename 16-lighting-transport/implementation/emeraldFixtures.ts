// Positions dérivées du modèle Emerald Square (lecture seule du Lab principal, jamais modifié).
// Calculées une fois hors-ligne à partir de public/benchmark-assets/emerald-square/emerald-day.gltf :
// noeuds dont le nom contient « Lamppost » (24 trouvés), matrice monde composée le long de la
// hiérarchie glTF (le fichier source utilise une échelle racine cm → m). Base du mât ; +4.2 m pour
// approcher la hauteur du luminaire. Au-delà des 24 lampadaires réels, le curseur 1-30 complète avec
// une petite grille le long du même pâté de maisons (repères « grille-N » ci-dessous), comme prévu
// par la consigne quand le modèle n'en fournit pas assez.
import type { Vec3 } from '../contracts.ts';
export type { Vec3 };

export const EMERALD_STREETLIGHT_HEAD_OFFSET_M = 4.2;

/** Base des mâts (y ≈ sol), issues des nœuds glTF Light_Lamppost*. */
export const EMERALD_STREETLIGHT_BASES: readonly { readonly node: string; readonly position: Vec3 }[] = [
  { node: 'Light_Lamppost2', position: [-42.6, 0.1, 53.4] },
  { node: 'Light_Lamppost3', position: [-53.4, 0.1, 42.8] },
  { node: 'Light_Lamppost4', position: [-53.4, 0.1, 33.9] },
  { node: 'Light_Lamppost5', position: [-42.8, 0.1, 23.3] },
  { node: 'Light_Lamppost6', position: [-34, 0.1, 23.3] },
  { node: 'Light_Lamppost7', position: [-23.4, 0.1, 33.8] },
  { node: 'Light_Lamppost8', position: [-23.4, 0.1, 42.8] },
  { node: 'Light_Lamppost9', position: [-52.1, 0.1, 63.7] },
  { node: 'Light_Lamppost10', position: [-52.1, 0.1, 58.3] },
  { node: 'Light_Lamppost11', position: [-63.6, 0.1, 51.4] },
  { node: 'Light_Lamppost12', position: [-58.2, 0.1, 51.4] },
  { node: 'Light_Lamppost13', position: [-63.6, 0.1, 24.2] },
  { node: 'Light_Lamppost14', position: [-58.2, 0.1, 24.2] },
  { node: 'Light_Lamppost15', position: [-52.1, 0.1, 13.1] },
  { node: 'Light_Lamppost16', position: [-52.1, 0.1, 18.5] },
  { node: 'Light_Lamppost17', position: [-24.3, 0.1, 13.1] },
  { node: 'Light_Lamppost18', position: [-24.3, 0.1, 18.5] },
  { node: 'Light_Lamppost19', position: [-13.3, 0.1, 24.8] },
  { node: 'Light_Lamppost20', position: [-18.7, 0.1, 24.8] },
  { node: 'Light_Lamppost21', position: [-13.3, 0.1, 52] },
  { node: 'Light_Lamppost22', position: [-18.7, 0.1, 52] },
  { node: 'Light_Lamppost23', position: [-24.6, 0.1, 63.6] },
  { node: 'Light_Lamppost24', position: [-24.6, 0.1, 58.2] },
  { node: 'Light_Lamppost_5', position: [-34.1, 0.1, 53.4] },
];

/** Repères de secours (grille le long du pâté de maisons) si le curseur dépasse les 24 lampadaires trouvés. */
export const EMERALD_STREETLIGHT_GRID_FALLBACK: readonly { readonly node: string; readonly position: Vec3 }[] = [
  { node: 'grille-1', position: [-38, 0.1, 13.1] },
  { node: 'grille-2', position: [-38, 0.1, 63.7] },
  { node: 'grille-3', position: [-13.3, 0.1, 38] },
  { node: 'grille-4', position: [-63.6, 0.1, 38] },
  { node: 'grille-5', position: [-28, 0.1, 28] },
  { node: 'grille-6', position: [-48, 0.1, 48] },
];

export const EMERALD_STREETLIGHTS: readonly { readonly node: string; readonly position: Vec3 }[] =
  [...EMERALD_STREETLIGHT_BASES, ...EMERALD_STREETLIGHT_GRID_FALLBACK];

/** Parcours fermé de la voiture (boîte de secours, aucun véhicule dans le modèle) : anneau rectangulaire
 * inscrit dans le pâté de maisons délimité par les lampadaires, à hauteur de rue. */
export const EMERALD_CAR_LOOP: readonly Vec3[] = [
  [-60, 0.4, 20],
  [-17, 0.4, 20],
  [-17, 0.4, 60],
  [-60, 0.4, 60],
  [-60, 0.4, 20],
];
