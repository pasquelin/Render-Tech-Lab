export function StatItem({ id, label, value, help, primary = false }: { id: string; label: string; value: string; help: string; primary?: boolean }) {
  return (
    <div className="stat min-w-0 p-2" role="group" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <div id={`${id}-title`} className="stat-title text-[10px] uppercase tracking-wider text-base-content/50 font-semibold">{label}</div>
      <div id={id} className={`stat-value text-sm whitespace-normal break-words font-bold font-mono ${primary ? 'text-primary' : 'text-base-content'}`}>{value}</div>
      <div id={`${id}-description`} className="stat-desc truncate text-[9px] text-base-content/40 font-mono">{help}</div>
    </div>
  );
}
