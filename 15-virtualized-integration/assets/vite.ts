import type { Plugin } from 'vite';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

/** Host-owned cache route: Vite's public-file inventory may predate preparation. */
export function createEmeraldAssetsPlugin(): Plugin {
 return {name:'emerald-prepared-assets',configureServer(server){
  const root=resolve(server.config.root,'public/benchmark-assets/emerald-derived');
  server.middlewares.use('/benchmark-assets/emerald-derived',(req,res)=>{
   void (async()=>{
    const fail=(status:number,message:string)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:message}));};
    if(req.method!=='GET'&&req.method!=='HEAD'){fail(405,'GET or HEAD required');return;}
    let relative:string;try{relative=decodeURIComponent((req.url??'').split('?')[0]);}catch{fail(400,'Invalid resource URL');return;}
    const candidate=resolve(root,'.'+relative);
    if(!candidate.startsWith(root+sep)){fail(403,'Resource outside Emerald cache');return;}
    const type:Record<string,string>={'.json':'application/json','.gltf':'model/gltf+json','.bin':'application/octet-stream'};
    if(!type[extname(candidate)]){fail(404,'Unknown Emerald resource type');return;}
    try{
     const [base,target]=await Promise.all([realpath(root),realpath(candidate)]);
     if(!target.startsWith(base+sep)){fail(403,'Resource outside Emerald cache');return;}
     const info=await stat(target);if(!info.isFile()){fail(404,'Resource is not a file');return;}
     res.setHeader('Content-Type',type[extname(target)]);res.setHeader('Content-Length',info.size);res.setHeader('Cache-Control','no-cache');
     if(req.method==='HEAD'){res.end();return;}
     const stream=createReadStream(target);res.once('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);
    }catch{fail(404,'Model cache resource missing; run pnpm prepare:models');}
   })().catch(()=>{res.statusCode=500;res.end();});
  });
 }};
}
