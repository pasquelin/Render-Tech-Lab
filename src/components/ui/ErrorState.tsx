import type { ReactNode } from 'react';
export function ErrorState({message,action}:{message:string;action?:ReactNode}){return <section data-ui-state="error" role="alert" className="flex flex-col items-center justify-center text-center gap-3 p-6"><p>{message}</p>{action}</section>;}
