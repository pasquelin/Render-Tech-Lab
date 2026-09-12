import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';

const origin=process.env.LAB_URL??'http://localhost:5174';
const browser=await chromium.launch({channel:process.env.RTL_BROWSER_CHANNEL??'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await mkdir('benchmark-runs/checks/emerald-engine-path',{recursive:true});
 await page.goto(`${origin}/?test=15-virtualized-integration`);
 await page.locator('[data-emerald-availability="ready"]').waitFor({timeout:30000});
 await page.getByRole('radio', { name: 'Parcours urbain reproductible' }).click();
 assert.equal(await page.locator('#lab-mode-card').count(),0);
 assert.equal(await page.locator('#emerald-engine').count(),0);
 await page.locator('main').getByRole('button',{name:'Lancer le parcours urbain'}).click();
 await page.locator('[data-emerald-status="ready"], [data-emerald-status="error"]').waitFor({timeout:180000});
 assert.equal(await page.locator('[data-emerald-status]').getAttribute('data-emerald-status'),'ready',await page.locator('main').innerText());
 await page.getByRole('main').getByText('1/3 · Three.js · 1/10 · Vue générale de la ville · Rendu texturé',{exact:true}).waitFor({timeout:30000});
 assert.ok(await page.locator('#canvas-emerald').getAttribute('data-emerald-surface'));
 await page.getByRole('button',{name:'Arrêter l’exploration'}).click();
 await page.locator('[data-emerald-report]').waitFor();
 const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('render-tech-lab:emerald-runs:v1'))[0]);
 assert.deepEqual(report.pathEngines,['three-webgl-reference','exact-cluster-pages','three-lod']);
 assert.equal(report.configuration.mode,'path');
 assert.equal(report.pathVersion,3);
 assert.ok(report.captures.length>=1,'at least one still');
 const still=report.captures[0];
 assert.equal(still.engine,'three-webgl-reference');
 assert.ok(still.pose);
 assert.equal(still.gpuMs,null);
 assert.ok(still.resolution[0]>1);
 await writeFile('benchmark-runs/checks/emerald-engine-path/result.json',JSON.stringify({pathEngines:report.pathEngines,captures:report.captures.length,still:{engine:still.engine,segment:still.segment,triangles:still.triangles,resolution:still.resolution},errors},null,2));
 assert.deepEqual(errors,[]);
 console.log('PASS automatic path loop',{pathEngines:report.pathEngines,captures:report.captures.length});
}finally{await browser.close();}
