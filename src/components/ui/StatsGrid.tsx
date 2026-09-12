import { StatItem } from './StatItem.tsx';
export type StatData={id:string;label:string;value:string;help:string;primary?:boolean};
export function StatsGrid({items}:{items:StatData[]}){return <div className="stats lab-live-stats min-w-0 bg-base-100 border border-base-content/10 shadow-xs rounded-box w-full"><div className="lab-live-grid divide-x divide-base-content/5">{items.map(item=><StatItem key={item.id}{...item}/>)}</div></div>;}
