export const emeraldNumber = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined ? 'Non mesuré' : value.toLocaleString('fr-FR', { maximumFractionDigits: digits });
