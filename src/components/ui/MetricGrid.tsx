export type MetricData = { label: string; value: string; unit?: string; provenance?: string; status?: string; ratio?: number };

export function MetricGrid({ items, label = 'Métriques spécifiques' }: { items: MetricData[]; label?: string }) {
  return (
    <section aria-label={label} className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">{label}</h3>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        {items.map(item => (
          <div key={item.label} className="rounded-box bg-base-300/60 p-3">
            <dt className="text-base-content/60">{item.label}</dt>
            <dd className="font-mono break-words">{item.value}{item.unit ? ` ${item.unit}` : ''}</dd>
            {item.provenance ? <p className="text-[9px] text-base-content/45">{item.provenance}</p> : null}
            {item.ratio !== undefined ? (
              <div className="mt-2 h-1.5 rounded bg-base-100 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(1, item.ratio)) * 100}%` }} />
              </div>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
