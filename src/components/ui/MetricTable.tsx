/** Une ligne : autant de cellules que de colonnes, plus une note optionnelle sous la première. */
export type MetricTableRow = { id?: string; cells: readonly string[]; note?: string };

/**
 * Le pendant de `MetricGrid` quand une métrique a plusieurs colonnes comparables entre lignes mais
 * pas entre elles. Comme toutes les primitives, elle ne porte aucune donnée, aucun libellé ni aucune
 * règle de banc : uniquement la structure accessible et les classes DaisyUI déjà utilisées par les
 * tableaux des rapports.
 */
export function MetricTable({ columns, rows, label = 'Métriques spécifiques', provenance }: {
  columns: readonly string[]; rows: readonly MetricTableRow[]; label?: string; provenance?: string;
}) {
  return (
    <section aria-label={label} className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">{label}</h3>
      <div className="overflow-x-auto rounded-box border border-base-content/10 bg-base-200/40">
        <table className="table table-zebra table-xs w-full font-mono text-xs">
          <thead><tr>{columns.map(column => <th key={column} className="bg-base-300 text-base-content/80">{column}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id ?? rowIndex} id={row.id}>
                {row.cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cellIndex === 0 ? 'align-top break-words' : 'align-top whitespace-nowrap'}>
                    {cell}
                    {cellIndex === 0 && row.note ? <p className="text-[9px] text-base-content/45 whitespace-normal">{row.note}</p> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {provenance ? <p className="text-[9px] text-base-content/45">{provenance}</p> : null}
    </section>
  );
}
