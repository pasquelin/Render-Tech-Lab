export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Preserve JavaScript-only values explicitly: a benchmark archive must not silently lose evidence. */
export function losslessValue(value: unknown, seen = new WeakSet<object>()): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : { $number: String(value) };
  if (typeof value === 'undefined') return { $undefined: true };
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  if (typeof value === 'symbol') return { $symbol: String(value) };
  if (typeof value === 'function') return { $function: String(value) };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (value instanceof Error) return { $error: { name: value.name, message: value.message, stack: value.stack ?? null } };
  if (ArrayBuffer.isView(value)) return { $typedArray: value.constructor.name, base64: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') };
  if (value instanceof ArrayBuffer) return { $arrayBuffer: Buffer.from(value).toString('base64') };
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return { $circular: true };
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => losslessValue(item, seen));
  const object: Record<string, JsonValue> = {};
  for (const key of Reflect.ownKeys(value)) {
    const name = typeof key === 'string' ? key : `[${String(key)}]`;
    object[name] = losslessValue((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return object;
}
