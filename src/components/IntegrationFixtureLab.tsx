import {useEffect,useRef,useState} from 'react';
import {LabSession} from '../lab/bootLab.ts';
import {initialSnapshot,type LabActions,type LabSnapshot} from '../lab/labState.ts';
import {navigateLabRoute} from '../lab/navigation.ts';
import {parseMarkdownToHtml} from '../lab/markdown.ts';
import type {IntegrationScene} from '../lab/emeraldView.ts';
import {LabContext} from './LabContext.tsx';
import {LabShell} from './LabShell.tsx';
const test='15-virtualized-integration';
/** The procedural fixture starts its session only after the shared launch action. */
export function IntegrationFixtureLab({onScene}:{onScene:(scene:IntegrationScene)=>void}){
 const webglRef=useRef<HTMLCanvasElement>(null),webgpuRef=useRef<HTMLCanvasElement>(null),chartRef=useRef<HTMLCanvasElement>(null);
 const [state,setState]=useState<LabSnapshot>(()=>initialSnapshot(test)),[attempt,setAttempt]=useState(0);
 const stopRef=useRef<()=>void>(()=>{}),disposeRef=useRef<()=>void>(()=>{});
 const launch=()=>{if(state.running)return;setState(old=>({...old,running:true,framePresented:false,execution:{status:'running',phase:'Préparation des contrôles…',lastCampaign:null}}));setAttempt(v=>v+1);};
 useEffect(()=>{
  if(!attempt)return;
  let cancelled=false,session:LabSession|undefined,unsubscribe:(()=>void)|undefined;
  const release=()=>{unsubscribe?.();session?.dispose();};disposeRef.current=release;
  stopRef.current=()=>{if(session)session.actions.stopBenchmark?.();else{cancelled=true;setState(old=>({...old,running:false,execution:{...old.execution,status:'stopped',phase:'Préparation arrêtée.'}}));}};
  void(async()=>{try{await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));if(cancelled)return;session=new LabSession({webgl:document.createElement('canvas'),webgpu:document.createElement('canvas'),chart:chartRef.current??document.createElement('canvas')});await session.start();if(cancelled){release();return;}session.actions.runBenchmark();unsubscribe=session.subscribe(snapshot=>{if(!cancelled)setState(snapshot);});}catch(error){release();if(!cancelled)setState(old=>({...old,running:false,execution:{status:'error',phase:String(error),lastCampaign:null}}));}})();
  return()=>{cancelled=true;release();};
 },[attempt]);
 const openReport=async()=>{setState(old=>({...old,reportModal:{...old.reportModal,open:true,title:'Rapport · Fixture procédurale',html:'<p>Chargement du rapport…</p>'}}));try{const response=await fetch('/api/get-report?testId=15-virtualized-integration');const raw=await response.text();setState(old=>({...old,reportModal:{...old.reportModal,raw,html:parseMarkdownToHtml(raw)}}));}catch{setState(old=>({...old,reportModal:{...old.reportModal,html:'<p>Rapport indisponible. Réessayez.</p>'}}));}};
 const actions:LabActions={switchModule:id=>{if(!state.running)navigateLabRoute(id);},setMode:()=>{},setScenario:()=>{},runBenchmark:launch,stopBenchmark:()=>stopRef.current(),runPain:launch,newExecution:()=>{if(state.running)return;disposeRef.current();setState(old=>({...initialSnapshot(test),execution:{...old.execution,status:'idle',phase:''}}));},openReport,closeReport:()=>setState(old=>({...old,reportModal:{...old.reportModal,open:false}})),copyReport:()=>{},refreshReport:openReport,openFinder:()=>{}};
 return <LabContext.Provider value={{state,actions,onIntegrationScene:scene=>{if(!state.running)onScene(scene);}}}><LabShell webglRef={webglRef} webgpuRef={webgpuRef} chartRef={chartRef}/></LabContext.Provider>;
}
