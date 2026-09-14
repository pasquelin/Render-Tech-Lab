import type {Plugin} from 'vite';
import {randomUUID} from 'node:crypto';
import {readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {atomicWrite,writeReportPackage} from '../../shared/archive/index.ts';
import type {LightingArchiveEntry,LightingArchiveHistory,LightingReport} from '../contracts.ts';
import {formatLightingReport} from '../implementation/report.ts';

const testId='16-lighting-transport';
const packagePattern=/^campaign-[a-zA-Z0-9-]+$/;
const emptyHistory=():LightingArchiveHistory=>({formatVersion:1,latestAttempt:null,latestValid:null,attempts:[]});
const json=(value:unknown)=>JSON.stringify(value,null,2)+'\n';

function validateReport(value:unknown):LightingReport {
  const report=value as LightingReport|undefined;
  if(!report||report.formatVersion!==1||typeof report.id!=='string'||!report.id||
    typeof report.timestamp!=='string'||!Number.isFinite(Date.parse(report.timestamp))||
    !['measured','rejected','stopped','error'].includes(report.status)||!report.protocol||!report.config||
    !report.quality||![true,false,null].includes(report.quality.passed)||!Array.isArray(report.quality.captures)||
    !Array.isArray(report.blocks)||!Array.isArray(report.artifacts)||!Array.isArray(report.limitations))throw Error('Rapport Lumière invalide');
  for(const block of report.blocks){
    if(!['brute','bvh'].includes(block.variant)||!['cadence','gpu-isolated'].includes(block.kind)||!Array.isArray(block.frames))throw Error('Bloc de mesures invalide');
    for(const frame of block.frames)if(!frame||frame.variant!==block.variant||frame.gpuMs!==null&&(!Number.isFinite(frame.gpuMs)||frame.gpuMs<0))throw Error('Mesure GPU invalide');
  }
  return report;
}

/** Only compact metadata is loaded at idle; image payloads stay inside report packages. */
export function createLightingArchiveStore(root:string){
  const directory=join(root,'reports',testId),historyPath=join(directory,'history.json');
  let queue=Promise.resolve();
  const history=async():Promise<LightingArchiveHistory>=>{
    try{return JSON.parse(await readFile(historyPath,'utf8')) as LightingArchiveHistory;}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return emptyHistory();throw error;}
  };
  const read=async(packageId:string)=>{
    if(!packagePattern.test(packageId)||(await history()).attempts.every(entry=>entry.package!==packageId))throw Error('Rapport Lumière absent');
    return readFile(join(directory,packageId,'REPORT.md'),'utf8');
  };
  const save=(value:unknown)=>{
    const operation=queue.then(async()=>{
      const report=validateReport(value),previous=await history();
      const packageId='campaign-'+randomUUID();
      try{await writeReportPackage(root,{testId,id:packageId,humanMarkdown:formatLightingReport(report),result:report,archivedAt:report.timestamp});}
      catch(error){await rm(join(directory,packageId),{recursive:true,force:true});throw error;}
      const entry:LightingArchiveEntry={package:packageId,id:report.id,timestamp:report.timestamp,status:report.status,qualityPassed:report.quality.passed};
      const valid=report.status==='measured'&&report.quality.passed===true;
      const latestValid=valid?packageId:previous.latestValid;
      const recent=[entry,...previous.attempts].slice(0,5);
      const retainedValid=previous.attempts.find(item=>item.package===latestValid);
      if(retainedValid&&!recent.some(item=>item.package===latestValid))recent.push(retainedValid);
      const next:LightingArchiveHistory={formatVersion:1,latestAttempt:packageId,latestValid,attempts:recent};
      await atomicWrite(historyPath,json(next));
      const current=recent.find(item=>item.package===latestValid)??entry;
      await atomicWrite(join(directory,'latest.json'),json({archivedAt:current.timestamp,reportPackage:current.package}));
      if(valid){
        const records=report.blocks.filter(block=>block.kind==='gpu-isolated').flatMap(block=>block.frames.map(frame=>({variant:block.variant,cpuMs:null,gpuMs:frame.gpuMs})));
        await atomicWrite(join(root,testId,'results/latest.json'),json({test:testId,timestamp:report.timestamp,status:'measured',records}));
      }
      const retained=new Set(recent.map(item=>item.package));
      for(const old of previous.attempts)if(!retained.has(old.package)&&packagePattern.test(old.package))await rm(join(directory,old.package),{recursive:true,force:true});
      return {...next,entry};
    });
    queue=operation.then(()=>{},()=>{});
    return operation;
  };
  return {history,read,save};
}

export function createLightingArchivePlugin():Plugin {
  return {name:'lighting-bench-archives',configureServer(server){
    const store=createLightingArchiveStore(server.config.root);
    server.middlewares.use('/api/lighting-report',(req,res)=>{
      void(async()=>{
        res.setHeader('Cache-Control','no-store');
        if(req.method==='GET'){
          const url=new URL(req.url??'','http://localhost'),packageId=url.searchParams.get('package');
          if([...url.searchParams.keys()].some(key=>key!=='package')){res.statusCode=400;res.end('Paramètre de rapport inconnu');return;}
          res.setHeader('Content-Type',packageId?'text/markdown; charset=utf-8':'application/json');
          res.end(packageId?await store.read(packageId):json(await store.history()));return;
        }
        if(req.method!=='POST'){res.statusCode=405;res.end('GET ou POST requis');return;}
        req.setEncoding('utf8');
        let body='',bytes=0;
        for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>64*1024*1024)throw Error('Rapport trop volumineux');body+=chunk;}
        const saved=await store.save(JSON.parse(body));
        res.setHeader('Content-Type','application/json');res.end(json(saved));
      })().catch(error=>{res.statusCode=req.method==='GET'?404:400;res.end(error instanceof Error?error.message:String(error));});
    });
  }};
}
