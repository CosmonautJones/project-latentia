// clonePlain (B6, Ruling 109): the deep copy simulate and createBattle take of setups, decks and commands on every
// battle. For plain JSON-compatible data it gives the JSON round-trip result (equal values, keys in order, `undefined`
// values and -0 kept), not exactly structuredClone's: an object referenced twice is copied twice, where structuredClone
// keeps the sharing (Ruling 115). Anything else is handed to structuredClone whole.

/** Thrown inside copy when the value is not plain data; clonePlain then uses structuredClone. */
const NOT_PLAIN = Symbol('not plain');
/** Deeper than this is not a setup or a command (and may be a cycle): structuredClone handles it. */
const MAX_DEPTH = 64;

function copy(v: unknown, depth: number): unknown {
  if (typeof v !== 'object' || v === null) {
    if (typeof v === 'function' || typeof v === 'symbol') throw NOT_PLAIN;
    return v;
  }
  if (depth > MAX_DEPTH) throw NOT_PLAIN;
  if (Array.isArray(v)) {
    // A sparse array or one with extra properties: Object.keys does not list exactly its indices.
    if (Object.getPrototypeOf(v) !== Array.prototype || Object.keys(v).length !== v.length) throw NOT_PLAIN;
    const out: unknown[] = [];
    for (let i = 0; i < v.length; i++) out.push(copy(v[i], depth + 1));
    return out;
  }
  const proto: unknown = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) throw NOT_PLAIN;
  const record = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (key === '__proto__') throw NOT_PLAIN; // assigning it would set the copy's prototype, not an own key
    out[key] = copy(record[key], depth + 1);
  }
  return out;
}

/**
 * A deep copy sharing no objects with `value` (nor, for plain data, objects within itself: shared references are
 * duplicated): arrays, plain (or null-prototype) objects and primitives are copied directly, own enumerable keys in
 * order; for any other value (a Map, a class instance, a function, a sparse array, an
 * own `__proto__` key, a very deep or cyclic structure) the result is structuredClone(value).
 */
export function clonePlain<T>(value: T): T {
  try {
    return copy(value, 0) as T;
  } catch (e) {
    if (e === NOT_PLAIN) return structuredClone(value);
    throw e;
  }
}
