import type { FrameMetrics } from '@web-geometry/sdk/browser';
import type { EmeraldConfig, EmeraldReport } from './emeraldCampaign.ts';
export type IntegrationScene = 'emerald' | 'procedural';
export type EmeraldView = {
 status:'idle'|'loading'|'ready'|'completed'|'stopped'|'error';message:string;
 availability:{status:'checking'|'ready'|'error';message:string};retryAvailability():void;
 progress:{completed:number;total:number}|null;metrics:FrameMetrics|null;frameIntervalMs:number|null;position:string;
 config:EmeraldConfig;setConfig(value:Partial<EmeraldConfig>):void;
 availableTriangles:number;report:EmeraldReport|null;history:EmeraldReport[];showReport(id:string):void;exportReport():void;
 stop():void;restart():void;
};
