import type { ReactNode } from 'react';
export function EmptyState({title,children}:{title:string;children:ReactNode}){return <section data-ui-state="empty" className="flex flex-col items-center justify-center text-center gap-3 p-6"><h2 className="text-lg font-semibold">{title}</h2>{children}</section>;}
