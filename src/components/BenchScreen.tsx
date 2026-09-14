import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';

/** Common frame of the start and end screens: full viewport, status line, title, then the screen's own content. */
export function BenchScreen({ screen, view, statusLabel, title, children }: { screen: 'start' | 'end'; view: string; statusLabel: string; title: string; children: ReactNode }) {
  return <div data-bench-screen={screen} data-execution-view={view} className="w-full h-full min-w-0 min-h-0 flex-1 overflow-auto bg-base-100 p-5 md:p-6">
    <section className="w-full min-w-0 wrap-break-word space-y-4">
      <div className="flex items-center gap-2 text-xs font-mono text-primary"><Activity className="w-4 h-4" /><span>{statusLabel}</span></div>
      <h1 className="text-xl md:text-2xl font-semibold">{title}</h1>
      {children}
    </section>
  </div>;
}
