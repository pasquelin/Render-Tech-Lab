import type { ReactNode } from 'react';
export function ChartPanel({children,label}:{children:ReactNode;label:string}){return <section aria-label={label} className="w-full h-44 bg-base-100 rounded-box border border-base-content/10 overflow-hidden relative">{children}</section>;}
