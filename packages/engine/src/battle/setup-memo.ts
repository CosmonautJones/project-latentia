// Validated-setup memo (C3.5): simulate and the balance sim play one setup object over thousands of seeds, and
// validateSetup on it costs more than playing a short battle's first round. createBattle remembers, per setup object,
// a private snapshot of the content that passed validation, and skips validation only while the object is still
// structurally identical to that snapshot. Validity depends on the setup's content alone (the content tables are
// constants), so an identical setup is valid again; any edit to the object — a value, a key, a key's order, an
// array's length — makes it differ, and it is validated afresh. Only strictly plain data is remembered: arrays
// without holes or extra properties, Object.prototype objects whose own properties are all enumerable, primitives;
// anything else (a class instance, a null-prototype object, a Map, a function, a cycle) is always validated.
// The memo holds nothing a battle reads, and BattleState is unchanged.

const MAX_DEPTH = 64;
const validated = new WeakMap<object, unknown>();

/** Thrown inside snapshot when the value is not strictly plain; nothing is remembered then. */
const NOT_PLAIN = Symbol('not plain');

const isPlainArray = (v: unknown[]): boolean => {
  if (Object.getPrototypeOf(v) !== Array.prototype || Object.getOwnPropertyNames(v).length !== v.length + 1) return false;
  for (let i = 0; i < v.length; i++) if (!Object.prototype.hasOwnProperty.call(v, i)) return false;
  return true;
};

const isPlainRecord = (v: object, keys: readonly string[]): boolean =>
  Object.getPrototypeOf(v) === Object.prototype && Object.getOwnPropertyNames(v).length === keys.length && !keys.includes('__proto__');

function snapshot(v: unknown, depth: number): unknown {
  if (typeof v === 'function' || typeof v === 'symbol') throw NOT_PLAIN;
  if (typeof v !== 'object' || v === null) return v;
  if (depth > MAX_DEPTH) throw NOT_PLAIN;
  if (Array.isArray(v)) {
    if (!isPlainArray(v)) throw NOT_PLAIN;
    const out: unknown[] = [];
    for (let i = 0; i < v.length; i++) out.push(snapshot(v[i], depth + 1));
    return out;
  }
  const keys = Object.keys(v);
  if (!isPlainRecord(v, keys)) throw NOT_PLAIN;
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = snapshot((v as Record<string, unknown>)[k], depth + 1);
  return out;
}

/** Whether `v` is strictly plain and equal to `snap` (a snapshot): same keys in the same order, Object.is leaves. */
function same(v: unknown, snap: unknown, depth: number): boolean {
  if (typeof v !== 'object' || v === null) return Object.is(v, snap);
  if (typeof snap !== 'object' || snap === null || depth > MAX_DEPTH) return false;
  if (Array.isArray(v)) {
    if (!Array.isArray(snap) || v.length !== snap.length || !isPlainArray(v)) return false;
    for (let i = 0; i < v.length; i++) if (!same(v[i], snap[i], depth + 1)) return false;
    return true;
  }
  if (Array.isArray(snap)) return false;
  const keys = Object.keys(v);
  const snapKeys = Object.keys(snap);
  if (keys.length !== snapKeys.length || !isPlainRecord(v, keys)) return false;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i] as string;
    if (k !== snapKeys[i] || !same((v as Record<string, unknown>)[k], (snap as Record<string, unknown>)[k], depth + 1)) return false;
  }
  return true;
}

/** Whether `setup` passed validation before and is structurally identical to what passed. */
export function knownValidSetup(setup: unknown): boolean {
  if (typeof setup !== 'object' || setup === null) return false;
  const snap = validated.get(setup);
  return snap !== undefined && same(setup, snap, 0);
}

/** Remembers that `setup` (just validated, with no errors) is valid, if it is strictly plain data. */
export function rememberValidSetup(setup: unknown): void {
  if (typeof setup !== 'object' || setup === null) return;
  try {
    validated.set(setup, snapshot(setup, 0));
  } catch (e) {
    if (e !== NOT_PLAIN) throw e;
    validated.delete(setup);
  }
}
