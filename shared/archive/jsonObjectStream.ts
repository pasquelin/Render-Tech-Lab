import { StringDecoder } from 'node:string_decoder';

export type JsonObjectEntry = { key: string; index?: number; value: unknown };

class ChunkCursor {
  private readonly iterator: AsyncIterator<Uint8Array | string>;
  private decoder = new StringDecoder('utf8');
  private chunk = '';
  private offset = 0;
  private ended = false;

  constructor(source: AsyncIterable<Uint8Array | string>) {
    this.iterator = source[Symbol.asyncIterator]();
  }

  async ensure(): Promise<boolean> {
    while (this.offset >= this.chunk.length) {
      if (this.ended) return false;
      const next = await this.iterator.next();
      if (next.done) {
        this.chunk = this.decoder.end();
        this.offset = 0;
        this.ended = true;
        continue;
      }
      if (typeof next.value === 'string') {
        this.chunk = this.decoder.end() + next.value;
        this.decoder = new StringDecoder('utf8');
      } else {
        this.chunk = this.decoder.write(Buffer.from(next.value));
      }
      this.offset = 0;
    }
    return true;
  }

  current(): string | undefined {
    return this.offset < this.chunk.length ? this.chunk[this.offset] : undefined;
  }

  remaining(): string {
    return this.chunk.slice(this.offset);
  }

  advance(count: number) {
    this.offset += count;
  }

  async close() {
    if (this.ended) return;
    this.ended = true;
    await this.iterator.return?.();
  }
}

function syntax(message: string): never {
  throw new SyntaxError(`Invalid JSON stream: ${message}`);
}

function whitespace(character: string | undefined): boolean {
  return character === ' ' || character === '\t' || character === '\r' || character === '\n';
}

async function skipWhitespace(cursor: ChunkCursor) {
  while (true) {
    const character = cursor.current();
    if (character === undefined) {
      if (!(await cursor.ensure())) return;
      continue;
    }
    if (!whitespace(character)) return;
    cursor.advance(1);
  }
}

async function readRawValue(cursor: ChunkCursor): Promise<string> {
  await skipWhitespace(cursor);
  if (cursor.current() === undefined && !(await cursor.ensure())) syntax('truncated value');
  const first = cursor.current();
  if (first === undefined) syntax('truncated value');

  if (first === '"') {
    const segments: string[] = [];
    segments.push('"');
    cursor.advance(1);
    let escaped = false;
    while (true) {
      if (cursor.current() === undefined) {
        if (!(await cursor.ensure())) syntax('truncated string');
        continue;
      }
      const text = cursor.remaining();
      let index = 0;
      while (index < text.length) {
        const character = text[index++];
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') {
          cursor.advance(index);
          segments.push(text.slice(0, index));
          return segments.join('');
        }
      }
      cursor.advance(index);
      segments.push(text);
    }
  }

  if (first === '{' || first === '[') {
    const segments: string[] = [];
    let depth = 0;
    let inString = false;
    let escaped = false;
    while (true) {
      if (cursor.current() === undefined) {
        if (!(await cursor.ensure())) syntax('truncated composite value');
        continue;
      }
      const text = cursor.remaining();
      let index = 0;
      while (index < text.length) {
        const character = text[index++];
        if (inString) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === '"') inString = false;
          continue;
        }
        if (character === '"') inString = true;
        else if (character === '{' || character === '[') depth++;
        else if (character === '}' || character === ']') {
          depth--;
          if (depth === 0) {
            cursor.advance(index);
            segments.push(text.slice(0, index));
            return segments.join('');
          }
          if (depth < 0) syntax('unexpected closing delimiter');
        }
      }
      cursor.advance(index);
      segments.push(text);
    }
  }

  const segments: string[] = [];
  while (true) {
    if (cursor.current() === undefined) {
      if (!(await cursor.ensure())) break;
      continue;
    }
    const text = cursor.remaining();
    let index = 0;
    while (index < text.length) {
      const character = text[index];
      if (whitespace(character) || character === ',' || character === ']' || character === '}') break;
      index++;
    }
    if (index === 0) break;
    cursor.advance(index);
    segments.push(text.slice(0, index));
    if (index < text.length) break;
  }
  const raw = segments.join('');
  if (!raw) syntax('expected a value');
  return raw;
}

async function readValue(cursor: ChunkCursor): Promise<unknown> {
  const raw = await readRawValue(cursor);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    syntax('invalid value');
  }
}

async function readKey(cursor: ChunkCursor): Promise<string> {
  const value = await readValue(cursor);
  if (typeof value !== 'string') syntax('object key must be a string');
  return value;
}

async function expect(cursor: ChunkCursor, expected: string) {
  if (cursor.current() === undefined && !(await cursor.ensure())) syntax(`expected ${expected}, received end of input`);
  const actual = cursor.current();
  cursor.advance(1);
  if (actual !== expected) syntax(`expected ${expected}, received ${actual ?? 'end of input'}`);
}

async function* readArray(cursor: ChunkCursor, key: string): AsyncGenerator<JsonObjectEntry> {
  await expect(cursor, '[');
  await skipWhitespace(cursor);
  if (cursor.current() === ']') {
    cursor.advance(1);
    yield { key, index: -1, value: [] };
    return;
  }
  let index = 0;
  while (true) {
    const value = await readValue(cursor);
    yield { key, index, value };
    index++;
    await skipWhitespace(cursor);
    if (cursor.current() === undefined && !(await cursor.ensure())) syntax('expected comma or ], received end of input');
    const delimiter = cursor.current();
    cursor.advance(1);
    if (delimiter === ']') return;
    if (delimiter !== ',') syntax(`expected comma or ], received ${delimiter ?? 'end of input'}`);
    await skipWhitespace(cursor);
    if (cursor.current() === undefined && !(await cursor.ensure())) syntax('truncated array');
    if (cursor.current() === ']') syntax('trailing comma in array');
  }
}

async function* readObject(cursor: ChunkCursor): AsyncGenerator<JsonObjectEntry> {
  await expect(cursor, '{');
  const keys = new Set<string>();
  await skipWhitespace(cursor);
  if (cursor.current() === '}') {
    cursor.advance(1);
    return;
  }
  while (true) {
    const key = await readKey(cursor);
    if (keys.has(key)) syntax(`duplicate top-level key ${JSON.stringify(key)}`);
    keys.add(key);
    await skipWhitespace(cursor);
    await expect(cursor, ':');
    await skipWhitespace(cursor);
    if (cursor.current() === '[') {
      yield* readArray(cursor, key);
    } else {
      yield { key, value: await readValue(cursor) };
    }
    await skipWhitespace(cursor);
    if (cursor.current() === undefined && !(await cursor.ensure())) syntax('expected comma or }, received end of input');
    const delimiter = cursor.current();
    cursor.advance(1);
    if (delimiter === '}') return;
    if (delimiter !== ',') syntax(`expected comma or }, received ${delimiter ?? 'end of input'}`);
    await skipWhitespace(cursor);
    if (cursor.current() === undefined && !(await cursor.ensure())) syntax('truncated object');
    if (cursor.current() === '}') syntax('trailing comma in object');
  }
}

async function* readRootArray(cursor: ChunkCursor): AsyncGenerator<JsonObjectEntry> {
  yield* readArray(cursor, '');
}

/** Streams entries from one strict top-level JSON object or array with backpressure. */
export async function* readJsonObjectEntries(source: AsyncIterable<Uint8Array | string>): AsyncGenerator<JsonObjectEntry> {
  const cursor = new ChunkCursor(source);
  try {
    await skipWhitespace(cursor);
    if (cursor.current() === undefined && !(await cursor.ensure())) syntax('top-level value must be an object or array');
    const first = cursor.current();
    if (first === '{') yield* readObject(cursor);
    else if (first === '[') yield* readRootArray(cursor);
    else syntax('top-level value must be an object or array');
    await skipWhitespace(cursor);
    if (cursor.current() !== undefined || await cursor.ensure()) syntax('trailing data after top-level value');
  } finally {
    await cursor.close();
  }
}
