import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {writeStreamedReportArchive,readReportArchive} from '../shared/archive/index.ts';

test('streamed archive updates the common latest pointer only after success',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'rtl-stream-index-'));
 const saved=await writeStreamedReportArchive(root,{testId:'15-virtualized-integration',humanMarkdown:'# Completed report'},Readable.from(['{"engineEvents":[],"captures":[]}']));
 assert.match((await readReportArchive(root,'15-virtualized-integration'))??'',/# Completed report/);
 const pointer=await readFile(saved.indexPath,'utf8');
 await assert.rejects(writeStreamedReportArchive(root,{testId:'15-virtualized-integration',humanMarkdown:'# Failed report'},Readable.from((async function*(){yield '{';throw new Error('interrupted');})())),/interrupted/);
 assert.equal(await readFile(saved.indexPath,'utf8'),pointer);
});
