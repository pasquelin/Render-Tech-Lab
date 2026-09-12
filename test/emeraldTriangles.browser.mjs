import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';

const origin=process.env.LAB_URL??'http://localhost:5174';
async function uniqueColors(page,png){
 return page.evaluate(async b64=>{
  const image=new Image();image.src=`data:image/png;base64,${b64}`;await image.decode();
  const copy=document.createElement('canvas');copy.width=image.width;copy.height=image.height;
  const ctx=copy.getContext('2d');ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,copy.width,copy.height).data,seen=new Set();
  for(let i=0;i<data.length;i+=16)seen.add(`${data[i]},${data[i+1]},${data[i+2]}`);
  return seen.size;
 },png.toString('base64'));
}

const browser=await chromium.launch({channel:process.env.RTL_BROWSER_CHANNEL??'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 await mkdir('benchmark-runs/checks/emerald-triangles',{recursive:true});
 await page.goto(`${origin}/?test=15-virtualized-integration`);
 await page.locator('[data-emerald-availability="ready"]').waitFor({timeout:30000});
 await page.getByLabel('Moteur affiché').selectOption('exact-cluster-pages');
 await page.getByLabel('Vue de diagnostic').selectOption('wireframe');
 await page.locator('main').getByRole('button',{name:'Explorer Emerald Square'}).click();
 await page.locator('[data-emerald-status="ready"], [data-emerald-status="error"]').waitFor({timeout:180000});
 assert.equal(await page.locator('[data-emerald-status]').getAttribute('data-emerald-status'),'ready',await page.locator('main').innerText());
 assert.equal(await page.locator('[data-rendered-mode]').getAttribute('data-rendered-mode'),'wireframe');
 const canvas=page.locator('#canvas-emerald');
 const triangles=await canvas.screenshot({path:'benchmark-runs/checks/emerald-triangles/triangles.png'});
 const colors=await uniqueColors(page,triangles);
 assert.ok(colors>80,`triangle view should show many submitted-triangle colors, got ${colors}`);
 await page.getByLabel('Vue de diagnostic').selectOption('clusters');
 await page.waitForTimeout(400);
 assert.equal(await page.locator('[data-rendered-mode]').getAttribute('data-rendered-mode'),'clusters');
 const clusters=await canvas.screenshot({path:'benchmark-runs/checks/emerald-triangles/clusters.png'});
 assert.notDeepEqual(triangles,clusters,'triangle colors must differ from cluster ids');
 await page.getByLabel('Vue de diagnostic').selectOption('beauty');
 await page.waitForTimeout(400);
 const beauty=await canvas.screenshot({path:'benchmark-runs/checks/emerald-triangles/beauty.png'});
 assert.notDeepEqual(triangles,beauty);
 const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('render-tech-lab:emerald-runs:v1')??'[]'));
 await page.getByRole('button',{name:'Arrêter l’exploration'}).click();
 const last=await page.evaluate(()=>JSON.parse(localStorage.getItem('render-tech-lab:emerald-runs:v1'))[0]);
 assert.ok(last.samples.some(sample=>sample.measurementKind==='diagnostic'));
 assert.ok(last.samples.some(sample=>(sample.submittedTriangles??sample.triangles??0)>0),'submitted triangles stay counted in the filled triangle view');
 console.log('PASS triangle diagnostic',{colors,samples:last.samples.length,history:report.length});
}finally{await browser.close();}
