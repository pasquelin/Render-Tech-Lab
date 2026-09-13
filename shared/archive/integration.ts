import { formatIntegrationReport } from '../../15-virtualized-integration/index.ts';
import type { IntegrationResult } from '../../15-virtualized-integration/index.ts';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { writeReportPackage } from './reportPackage.ts';

export async function archiveIntegration(root:string,value:unknown){
 if(!value||typeof value!=='object'||!('test' in value)||value.test!=='15-virtualized-integration'||!('archive' in value))throw new Error('Invalid integration report');
 const id=randomUUID();
 const sources:Record<string,{sha256:string;text:string}>={};
 for(const name of ['geometryAsset.ts','physicalPages.ts','clusterGpu.ts','virtualizedCampaign.ts','runner.ts']){
  const text=await readFile(join(root,'15-virtualized-integration',name === 'runner.ts' ? 'runner/index.ts' : `implementation/${name}`),'utf8');sources[name]={sha256:createHash('sha256').update(text).digest('hex'),text};
 }
 const archivedAt=new Date().toISOString();
 const raw={archivedAt,sourceSnapshotScope:'Source files at archive time; CLI smoke separately verifies before/after stability',sources,result:value};
 const engineEvents=[...(value as {archive?:{errors?:unknown[]}}).archive?.errors??[]].map(error=>({timestamp:archivedAt,level:'error' as const,phase:'campaign',message:String(error),context:{}}));
 await writeReportPackage(root,{testId:'15-virtualized-integration',id:`campaign-${id}`,humanMarkdown:formatIntegrationReport(value as IntegrationResult,id),result:raw,engineEvents,archivedAt});
 return {id,artifact:join('reports','15-virtualized-integration',`campaign-${id}`,'objects','result.json.gz')};
}
export function createIntegrationArchivePlugin():Plugin{
 let root='';
 const handle=async(req:IncomingMessage,res:ServerResponse)=>{
  if(req.method==='GET'){try{const id=new URL(req.url??'','http://localhost').searchParams.get('id');if(!id||!/^[0-9a-f-]{36}$/.test(id))throw new Error('Invalid archive id');res.setHeader('Content-Type','application/gzip');res.setHeader('Content-Disposition','attachment; filename=integration-result.json.gz');res.end(await readFile(join(root,'reports','15-virtualized-integration',`campaign-${id}`,'objects','result.json.gz')));}catch{res.statusCode=404;res.end('Aucune campagne archivée');}return;}
  if(req.method!=='POST'){res.statusCode=405;res.end();return;}
  try{if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){res.statusCode=403;res.end();return;}}catch{res.statusCode=403;res.end();return;}
  const chunks:Buffer[]=[];
  try{for await(const chunk of req) chunks.push(Buffer.from(chunk));
   const result=await archiveIntegration(root,JSON.parse(Buffer.concat(chunks).toString('utf8')));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  }catch(error){res.statusCode=400;res.end(JSON.stringify({error:String(error)}));}
 };
 return {name:'integration-archive',configResolved(config){root=config.root;},
  configureServer(server){server.middlewares.use('/api/integration-archive',(req,res)=>{void handle(req,res);});},
  configurePreviewServer(server){server.middlewares.use('/api/integration-archive',(req,res)=>{void handle(req,res);});}};
}
