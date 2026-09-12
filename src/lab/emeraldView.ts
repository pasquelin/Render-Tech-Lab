import type { FrameMetrics } from '@web-geometry/sdk/browser';
import type { EmeraldConfig, EmeraldReport } from './emeraldCampaign.ts';
import type { BenchEngineId } from '../../15-virtualized-integration/index.ts';
export type IntegrationScene = 'emerald' | 'procedural';
export const INTEGRATION_SCENE_OPTIONS = [
  { value: 'emerald' as const, title: 'Emerald Square', detail: 'Ville réelle, texturée, navigable.' },
  { value: 'procedural' as const, title: 'Fixture procédurale', detail: 'Petite scène déterministe pour les contrôles algorithmiques.' },
];
export type EmeraldView = {
 status:'idle'|'loading'|'ready'|'completed'|'stopped'|'error';message:string;
 availability:{status:'checking'|'ready'|'error';message:string};retryAvailability():void;
 progress:{completed:number;total:number}|null;metrics:FrameMetrics|null;frameIntervalMs:number|null;position:string;surfaceKey:string;
 config:EmeraldConfig;setConfig(value:Partial<EmeraldConfig>):void;
 availableEngines:Array<{id:BenchEngineId;label:string;available:boolean}>;
 selectEngine(id:BenchEngineId):void;
 selectDiagnostic(mode:EmeraldConfig['diagnostic']):void;
 availableTriangles:number;report:EmeraldReport|null;history:EmeraldReport[];showReport(id:string):void;exportReport():void;
 stop():void;restart():void;
};
