import type { ReactNode } from 'react';
export function ReportSummary({title,children}:{title:string;children:ReactNode}){return <section className="rounded-box border border-base-content/10 bg-base-200 p-4 space-y-2"><h3 className="text-sm font-semibold">{title}</h3>{children}</section>;}
