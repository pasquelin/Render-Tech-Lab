import type { FrameMetrics } from '@web-geometry/sdk/browser';
import type { ModelConfig, ModelReport } from './modelCampaign.ts';
import type { BenchEngineId } from '../../15-virtualized-integration/index.ts';
export type IntegrationScene = 'model' | 'procedural';
export const INTEGRATION_SCENE_OPTIONS = [
  { value: 'model' as const, title: 'Modèles préparés', detail: 'Modèles complets, texturés et navigables.' },
  { value: 'procedural' as const, title: 'Fixture procédurale', detail: 'Petite scène déterministe pour les contrôles algorithmiques.' },
];
export type ModelView = {
 status:'idle'|'loading'|'ready'|'completed'|'stopped'|'error';message:string;
 availability:{status:'checking'|'ready'|'error';message:string};retryAvailability():void;
 progress:{completed:number;total:number}|null;metrics:FrameMetrics|null;frameIntervalMs:number|null;position:string;surfaceKey:string;
 telemetry?:any;
 config:ModelConfig;setConfig(value:Partial<ModelConfig>):void;
 availableEngines:Array<{id:BenchEngineId;label:string;available:boolean}>;
 selectEngine(id:BenchEngineId):void;
 selectDiagnostic(mode:ModelConfig['diagnostic']):void;
 availableTriangles:number;report:ModelReport|null;history:ModelReport[];showReport(id:string):void;exportReport():void;
 stop():void;restart():void;
};
