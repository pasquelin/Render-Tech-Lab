import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const origin=process.env.LAB_URL??'http://127.0.0.1:5186';
const out=resolve('benchmark-runs/16-lighting-transport/browser',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--window-size=1440,1040','--disable-background-timer-throttling']});
const errors=[];
try{
  const context=await browser.newContext({viewport:{width:1440,height:1040},deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',error=>{errors.push(String(error));console.log('PAGE_ERROR',String(error));});
  page.on('console',message=>{if(message.type()==='error'){
    const expectedMissingArchive=message.text().includes('404')&&/\/api\/(get-latest|get-report)/.test(message.location().url);
    if(!expectedMissingArchive){errors.push(message.text());console.log('CONSOLE_ERROR',message.text(),message.location().url);}
  }});
  await page.goto(origin);await page.locator('[data-bench-access="16-lighting-transport"]').click();
  await page.locator('[data-lighting-status="idle"]').waitFor();
  assert.equal(await page.locator('canvas').count(),0);
  const sections=await page.locator('#sidebar section').evaluateAll(nodes=>nodes.map(node=>node.id).filter(Boolean));
  assert.deepEqual(sections,['lab-mode-card','lab-metrics-card','lab-run-card','lab-report-card']);
  await page.screenshot({path:join(out,'idle.png')});
  await page.setViewportSize({width:980,height:760});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:join(out,'idle-reduced.png')});
  await page.setViewportSize({width:1440,height:1040});
  await page.selectOption('#lighting-run-kind','comparison');await page.click('#lighting-launch');
  console.log(JSON.stringify({phase:'campaign-started',out}));
  await page.waitForFunction(()=>!!window.__lightingBench16Report||document.querySelector('[data-lighting-status="error"]'),null,{timeout:360000});
  const failure=await page.locator('[data-lighting-status="error"]').count();
  if(failure)throw Error(await page.locator('[data-lighting-status="error"]').innerText());
  const report=await page.evaluate(()=>window.__lightingBench16Report);
  await writeFile(join(out,'result.json'),JSON.stringify(report,null,2));
  for(const artifact of report.artifacts)await writeFile(join(out,artifact.scenario+'-'+artifact.variant+'.png'),Buffer.from(artifact.dataUrl.split(',')[1],'base64'));
  assert.equal(await page.locator('canvas').count(),0,'finished comparison releases canvas');
  await page.screenshot({path:join(out,'completed.png')});
  await page.locator('#lighting-open-report').click();
  await page.getByText('Banc 16 · Lumière',{exact:false}).first().waitFor();
  await page.screenshot({path:join(out,'report.png')});
  console.log(JSON.stringify({phase:'campaign-complete',quality:report.quality,blocks:report.blocks.map(b=>({variant:b.variant,kind:b.kind,count:b.frames.length})),errors,out}));
  assert.deepEqual(errors,[]);
  assert.equal(report.quality.passed,true,'exact A/A and A/B');
  assert.equal(report.status,'measured');
}finally{await browser.close();}
