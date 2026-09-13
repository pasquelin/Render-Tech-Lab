import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const origin=process.env.LAB_URL??'http://localhost:5174';
const browser=await chromium.launch({channel:process.env.RTL_BROWSER_CHANNEL??'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 await page.goto(`${origin}/?test=15-virtualized-integration`);
 await page.locator('[data-model-availability="ready"]').waitFor({timeout:30000});
 await page.locator('main').getByRole('button',{name:'Explorer le modèle',exact:true}).click();
 await page.locator('[data-model-status="ready"]').waitFor({timeout:180000});
 await page.locator('#canvas-model').evaluate(canvas=>canvas.setAttribute('data-previous-engine-canvas','true'));
 const surfaceBefore=await page.locator('#canvas-model').getAttribute('data-model-surface');
 await page.getByLabel('Moteur affiché',{exact:true}).selectOption('three-lod');
 await page.locator('[data-model-status="loading"]').waitFor({timeout:10000});
 await page.locator('[data-model-status="ready"]').waitFor({timeout:180000});
 assert.equal(await page.getByLabel('Moteur affiché',{exact:true}).inputValue(),'three-lod');
 assert.notEqual(await page.locator('#canvas-model').getAttribute('data-model-surface'),surfaceBefore);
 assert.equal(await page.locator('canvas[data-previous-engine-canvas="true"]').evaluate(canvas=>getComputedStyle(canvas).display),'none');
 await page.getByRole('button',{name:'Arrêter l’exploration',exact:true}).click();
}finally{await browser.close();}
