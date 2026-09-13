import {request} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createGunzip} from 'node:zlib';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';

// Replays saved bytes through the archive endpoint; never starts a renderer.
const [directory,origin='http://127.0.0.1:5275']=process.argv.slice(2);
if(!directory)throw new Error('Usage: verify-report-archive.ts <campaign-directory> [lab-origin]');
const markdown=(await readFile(path.join(directory,'REPORT.md'),'utf8')).replace(/^<!-- report-package:[^\n]*-->\s*/,'').split('\n## Dossier de preuve')[0];
async function* body(){
 yield JSON.stringify({testId:'15-virtualized-integration',markdown})+'\n';
 const source=createReadStream(path.join(directory,'objects/result.json.gz')),gunzip=createGunzip();
 const completed=pipeline(source,gunzip);void completed.catch(()=>{});
 try{for await(const chunk of gunzip)yield chunk;await completed;}finally{source.destroy();gunzip.destroy();}
}
let response:Promise<string>;
const req=request(new URL('/api/save-report',origin),{method:'POST',headers:{'Content-Type':'application/x-rtl-streamed-report'}});
response=new Promise((resolve,reject)=>{
 req.on('error',reject);
 req.on('response',res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;});res.on('error',reject);res.on('end',()=>res.statusCode===200?resolve(text):reject(new Error(`Archive HTTP ${res.statusCode}: ${text}`)));});
});
void response.catch(()=>{});
await pipeline(Readable.from(body()),req);
console.log(await response);
