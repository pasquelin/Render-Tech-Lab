import type { ReactNode } from 'react';

export const labCardClass = 'card bg-base-300/80 border border-base-content/10 shadow-xs p-3.5 gap-2.5 min-w-0';

export function LabSection({ number, title, badge, help, id, children }: { number: number; title: string; badge?: string; help?: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className={labCardClass}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider leading-tight min-w-0 text-base-content/60">{number}. {title}</h2>
        {badge ? <span className="badge badge-ghost badge-xs font-mono text-[10px]">{badge}</span> : null}
      </header>
      {help ? <p className="text-xs text-base-content/60 leading-tight">{help}</p> : null}
      {children}
    </section>
  );
}
