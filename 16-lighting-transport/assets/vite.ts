import type {Plugin} from 'vite';
import {mkdir, readFile, writeFile, readdir} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import {GLTF_TYPES, serveDirectory} from '../../shared/dev/serveDirectory.ts';

const hash = (value: Uint8Array|string) => createHash('sha256').update(value).digest('hex');
const revision = (root:string) => execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();

/** The host prepares generated inputs through the public SDK, only after the launch CTA. */
export function createLightingAssetsPlugin(): Plugin {
  let preparing = false;
  return {name:'lighting-bench-assets', configureServer(server) {
    const labRoot=server.config.root;
    const root=resolve(labRoot,'benchmark-runs/16-lighting-transport/prepared');
    server.middlewares.use('/api/lighting-prepare',(req,res)=>{
      if(req.method!=='POST'){res.statusCode=405;res.end('POST required');return;}
      if(preparing){res.statusCode=409;res.end('Preparation already running');return;}
      preparing=true;
      const abort=new AbortController();
      res.once('close',()=>{if(!res.writableEnded)abort.abort();});
      void(async()=>{
        const {createLightingScene,exportLightingGltf}=await import('@web-geometry/sdk');
        const {prepare}=await import('@web-geometry/sdk/node');
        const sdkRoot=dirname(fileURLToPath(import.meta.resolve('@web-geometry/sdk/package.json')));
        const native=process.env.WEB_GEOMETRY_COMPILER_BIN??join(sdkRoot,'packages/asset-compiler-rust/target/release/web-geometry-compiler');
        const scene=createLightingScene({doorAngle:Math.PI/2,lightIntensity:1,patchSize:1.2,roughness:.25});
        const {gltf,binary}=exportLightingGltf(scene),gltfBytes=JSON.stringify(gltf);
        const meshes=gltf.meshes as Array<{primitives:Array<{indices:number}>}>,accessors=gltf.accessors as Array<{count:number}>;
        const triangles=meshes.reduce((sum,mesh)=>sum+mesh.primitives.reduce((n,p)=>n+accessors[p.indices].count/3,0),0);
        const fixtureKey=hash(gltfBytes+hash(binary));
        const input=join(root,fixtureKey,'input'),cache=join(root,fixtureKey,'cache');
        await mkdir(input,{recursive:true});await mkdir(cache,{recursive:true});
        await writeFile(join(input,'scene.gltf'),gltfBytes);await writeFile(join(input,'scene.bin'),binary);
        const start=performance.now();
        // The SDK derives the source manifest from the glTF file itself, as prepare:models does for bench 15.
        const prepared=await prepare(join(input,'scene.gltf'),cache,'full',triangles,{resourceBaseUrl:`/lighting-data/${fixtureKey}/input/`,threads:2,ramBudgetMb:256,simplification:'none',executable:native,signal:abort.signal});
        if(prepared.status!=='ready')throw Error('Lighting fixture preparation failed');
        const preparationMs=performance.now()-start;
        const sourceHashes:Record<string,string>={};
        const sourceArchive=join('benchmark-runs/16-lighting-transport/provenance',new Date().toISOString().replace(/[:.]/g,'-'));
        const archiveSource=async(prefix:string,relative:string,source:string)=>{
          sourceHashes[`${prefix}/${relative}`]=hash(source);
          const target=join(labRoot,sourceArchive,prefix,relative);await mkdir(dirname(target),{recursive:true});await writeFile(target,source);
        };
        for(const directory of ['packages/sdk-core','packages/sdk-browser','dist/sdk-core','dist/sdk-browser']){
          const sources=(await readdir(join(sdkRoot,directory))).filter(name=>/^lighting.*\.(ts|js)$/.test(name)&&!name.endsWith('.test.ts')&&!name.endsWith('.d.ts')).sort();
          for(const name of sources){const relative=join(directory,name);await archiveSource('sdk',relative,await readFile(join(sdkRoot,relative),'utf8'));}
        }
        await archiveSource('sdk','dist/sdk-browser/buildProvenance.js',await readFile(join(sdkRoot,'dist/sdk-browser/buildProvenance.js'),'utf8'));
        for(const relative of ['16-lighting-transport/runner/index.ts','16-lighting-transport/contracts.ts','16-lighting-transport/scenarios/fixtures.ts','16-lighting-transport/assets/vite.ts']){
          await archiveSource('lab',relative,await readFile(join(labRoot,relative),'utf8'));
        }
        const result={manifestUrl:`/lighting-data/${fixtureKey}/cache/native/full/manifest.json`,preparationMs,fixtureKey,
          provenance:{sdkCommit:revision(sdkRoot),labCommit:revision(labRoot),sourceHashes,sourceArchive,compilerSha256:hash(await readFile(native)),inputSha256:{gltf:hash(gltfBytes),binary:hash(binary)},
          hardware:{platform:os.platform(),architecture:os.arch(),osRelease:os.release(),cpu:os.cpus()[0]?.model??null,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()}}};
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
      })().catch(error=>{if(!res.writableEnded){res.statusCode=500;res.end(JSON.stringify({error:String(error)}));}}).finally(()=>{preparing=false;});
    });
    server.middlewares.use('/lighting-data',serveDirectory(root,GLTF_TYPES,'Lighting resource unavailable'));
  }};
}
