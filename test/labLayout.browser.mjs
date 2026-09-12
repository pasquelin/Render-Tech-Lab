import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const origin = process.env.LAB_URL ?? 'http://localhost:5174';
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage({viewport:{width:1400,height:900}});
 await page.goto(`${origin}/?test=00-baseline`);
 await page.getByRole('heading',{name:'Dashboard'}).waitFor();
 assert.equal(await page.locator('#btn-benchmark').isVisible(),false);
 assert.equal(await page.locator('#lab-metrics-card').isVisible(),true);
 assert.equal(await page.locator('#canvas-chart').isVisible(),false);
 assert.equal(await page.locator('canvas').count(),0);
 await page.locator('#select-module').selectOption('01-indirect-draw');
 await page.getByRole('heading',{name:'01 · GPU-Driven Indirect Draw'}).waitFor();
 assert.equal(await page.locator('#canvas-chart').count(),1);
 assert.equal(await page.locator('#canvas-chart').isVisible(),true);
 await page.goto(`${origin}/?test=00-baseline`);
 await page.screenshot({path:'/tmp/baseline-consultation.png'});
 for(const width of [1400,700,390]) {
  await page.setViewportSize({width,height:900});
  await page.goto(`${origin}/test/labShellFixture.html`);
  await page.locator('[data-campaign-sidebar="completed"]').waitFor({state:'attached'});
  for (const phase of ['completed','running']) {
   if (phase === 'running') await page.goto(`${origin}/test/labShellFixture.html?state=running`);
   await page.locator(`[data-campaign-sidebar="${phase}"]`).waitFor({state:'attached'});
   const result = await page.locator('#viewport-container').evaluate(v=>{
    const scene=document.getElementById('scene-container'),canvas=document.getElementById('canvas-webgpu');
    const d=document.querySelector('#nav-module-description');
    return {viewport:v.getBoundingClientRect().toJSON(),scene:scene.getBoundingClientRect().toJSON(),canvas:canvas.getBoundingClientRect().toJSON(),headerBottom:document.querySelector('header').getBoundingClientRect().bottom,
     mainPadding:getComputedStyle(document.querySelector('main')).padding,mainText:document.querySelector('main').textContent,mainButtons:document.querySelector('main').querySelectorAll('button').length,
     preparations:v.querySelectorAll('[data-execution-view]').length,whiteSpace:getComputedStyle(d).whiteSpace,title:d.title,objectFit:getComputedStyle(canvas).objectFit};
   });
   assert.equal(result.mainPadding,'0px');
   assert.ok(result.viewport.top>=result.headerBottom-1);assert.equal(result.whiteSpace,'nowrap');assert.ok(result.title.length>20);assert.equal(result.objectFit,'cover');
   if (phase === 'running') {
    assert.equal(result.preparations,0);assert.equal(result.mainButtons,0);
    assert.doesNotMatch(result.mainText,/Campagne terminée|CPU Submit|Mesurer A\/B/);
    assert.equal(result.scene.height,result.viewport.height);assert.equal(result.canvas.height,result.viewport.height);assert.equal(result.canvas.width,result.viewport.width);
   } else {
    assert.ok(result.preparations>=1);
    assert.match(result.mainText,/Campagne terminée/);
    assert.equal(result.scene.height,0);
   }
   for(const id of ['select-module','btn-classic','btn-gpu-driven','select-count','btn-benchmark','btn-pain-benchmark','btn-view-report','btn-open-reports']) {
    assert.equal(await page.locator(`#${id}`).isDisabled(),phase==='running',`${id}: ${phase}`);
   }
   if(phase==='running') {
    assert.equal(await page.locator('#btn-stop-campaign').isEnabled(),true);
    const lockedStyle = await page.locator('#btn-benchmark').evaluate(button => ({ opacity: Number(getComputedStyle(button).opacity), cursor: getComputedStyle(button).cursor }));
    assert.ok(lockedStyle.opacity <= 0.5); assert.equal(lockedStyle.cursor, 'not-allowed');
    assert.equal(await page.locator('#btn-lod-comparison').getAttribute('href'),null);
    assert.equal(await page.locator('#btn-lod-comparison').getAttribute('aria-disabled'),'true');
   }
   if (width < 1024) await page.evaluate(()=>{ document.getElementById('sidebar-drawer').checked=true; });
   const grid = await page.locator('.lab-live-grid').evaluate(g => ({ columns: getComputedStyle(g).gridTemplateColumns.split(' ').length, width: g.clientWidth, scroll: g.scrollWidth }));
   assert.equal(grid.columns,width===1400?4:2);
   assert.ok(grid.scroll<=grid.width+1);
   await page.screenshot({path:`/tmp/lab-${phase}-${width}.png`});
  }
  console.log(`Layout ${width}px : validé`);
 }
 const legacyLock = await page.evaluate(async()=>{
  const { createControlLock } = await import('/src/lab/controlLock.ts');
  const root=document.createElement('div');document.body.append(root);
  const run=document.createElement('button'),stop=document.createElement('button'),link=document.createElement('a');
  stop.id='btn-pain-benchmark';link.href='/report';root.append(run,stop,link);
  let clicks=0;run.onclick=()=>clicks++;
  const lock=createControlLock(root);lock(true);
  const first=run.disabled&&!stop.disabled&&!link.hasAttribute('href')&&link.getAttribute('aria-disabled')==='true';
  run.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  const added=document.createElement('button');root.append(added);await Promise.resolve();
  const dynamic=added.disabled;
  lock(false);
  const restored=!run.disabled&&!added.disabled&&link.getAttribute('href')==='/report';
  root.remove();return {first,dynamic,restored,clicks};
 });
 assert.deepEqual(legacyLock,{first:true,dynamic:true,restored:true,clicks:0});
} finally {await browser.close();}
