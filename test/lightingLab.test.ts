import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('lighting starts without a rendering surface and owns its four canonical panels',async()=>{
  const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
  try {
    const {UnifiedLab}=await server.ssrLoadModule('/src/components/UnifiedLab.tsx');
    const html=renderToStaticMarkup(createElement(UnifiedLab,{test:'16-lighting-transport',native:false}));
    assert.match(html,/data-lighting-status="idle"/);
    assert.doesNotMatch(html,/<canvas\b/,'loading the route must not create a render surface');
    assert.equal((html.match(/id="lighting-launch"/g)??[]).length,1);
    assert.doesNotMatch(html,/id="lighting-relaunch"|id="lighting-stop"/);
    assert.match(html,/<label[^>]*for="lighting-run-kind"/);
    assert.match(html,/<select[^>]*id="lighting-run-kind"/);
    const sidebar=html.match(/<aside id="sidebar"[\s\S]*?<\/aside>/)?.[0]??'';
    const panels=['lab-mode-card','lab-metrics-card','lab-run-card','lab-report-card'];
    for(let i=0;i<panels.length;i++){
      assert.equal((sidebar.match(new RegExp('id="'+panels[i]+'"','g'))??[]).length,1);
      if(i)assert.ok(sidebar.indexOf(panels[i-1])<sidebar.indexOf(panels[i]));
    }
    const metrics=['CPU submit','CPU frame','FPS','Draw calls'];
    for(let i=1;i<metrics.length;i++)assert.ok(sidebar.indexOf(metrics[i-1])<sidebar.indexOf(metrics[i]));
    assert.match(sidebar,/Non mesuré/);
    assert.doesNotMatch(sidebar,/Emerald|Bistro|quartiers|model-start-engine|select-count|Graphique de campagne/);
    assert.doesNotMatch(sidebar,/data-light-id=/,'source settings come from the controller after an explicit launch');
  }finally{await server.close();}
});
