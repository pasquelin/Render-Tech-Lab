import type { ReactNode } from 'react';
import { Button } from './Button.tsx';
export function ActionBar({children,onNewExecution}:{children:ReactNode;onNewExecution?:()=>void}){return <div className="flex flex-wrap gap-2">{children}{onNewExecution?<Button variant="secondary" onClick={onNewExecution}>Nouvelle exécution</Button>:null}</div>;}
