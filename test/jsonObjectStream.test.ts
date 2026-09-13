import assert from 'node:assert/strict';
import test from 'node:test';
import { readJsonObjectEntries } from '../shared/archive/jsonObjectStream.ts';

async function* byteChunks(value: string, size = 1): AsyncGenerator<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  for (let offset = 0; offset < bytes.byteLength; offset += size) yield bytes.slice(offset, offset + size);
}

async function collect(source: AsyncIterable<Uint8Array | string>) {
  const entries: Array<{ key: string; index?: number; value: unknown }> = [];
  for await (const entry of readJsonObjectEntries(source)) entries.push(entry);
  return entries;
}

test('streams object fields and array items across byte chunks including UTF-8 and escapes', async () => {
  const entries = await collect(byteChunks('{"label":"é \\"quoted\\"","numbers":[-1,2.5e2],"event":{"message":"深","nested":[true,null]},"empty":[]}'));
  assert.deepEqual(entries, [
    { key: 'label', value: 'é "quoted"' },
    { key: 'numbers', index: 0, value: -1 },
    { key: 'numbers', index: 1, value: 250 },
    { key: 'event', value: { message: '深', nested: [true, null] } },
    { key: 'empty', index: -1, value: [] },
  ]);
});

test('streams a top-level array and emits the empty-array marker', async () => {
  assert.deepEqual(await collect(byteChunks('[]')), [{ key: '', index: -1, value: [] }]);
  const entries = await collect(byteChunks('[{"phase":"a","events":[1,2]},"é",false]', 2));
  assert.deepEqual(entries, [
    { key: '', index: 0, value: { phase: 'a', events: [1, 2] } },
    { key: '', index: 1, value: 'é' },
    { key: '', index: 2, value: false },
  ]);
});

test('rejects malformed, truncated, trailing-comma, duplicate-key and trailing-data input', async () => {
  const invalid = [
    '{"a":[1,]}',
    '{"a":1,}',
    '{"a":1,"a":2}',
    '{"a":{"broken":true}',
    '{"a":true false}',
    '{"a":1} trailing',
  ];
  for (const value of invalid) await assert.rejects(collect(byteChunks(value)), SyntaxError, value);
});

test('handles many array items without requiring a whole-array JSON string', async () => {
  const count = 5000;
  const entries = await collect(byteChunks(`{"samples":[${Array.from({ length: count }, (_, index) => index).join(',')}]}`, 127));
  assert.equal(entries.length, count);
  assert.deepEqual(entries[0], { key: 'samples', index: 0, value: 0 });
  assert.deepEqual(entries.at(-1), { key: 'samples', index: count - 1, value: count - 1 });
});

test('closes the upstream iterator when the consumer stops early', async () => {
  let closed = 0;
  const source: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      try {
        yield '{"events":[1,2,3,4]}';
        yield '';
      } finally {
        closed++;
      }
    },
  };
  for await (const entry of readJsonObjectEntries(source)) {
    assert.deepEqual(entry, { key: 'events', index: 0, value: 1 });
    break;
  }
  assert.equal(closed, 1);
});
