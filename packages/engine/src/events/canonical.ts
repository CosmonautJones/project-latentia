import { fnv1a64Hex } from './fnv';
import type { BattleEvent } from './types';

/**
 * JSON.stringify of strings seen before — string values (ids, event types) in `quoted`, object keys with their ':' in
 * `labels`. The vocabulary is small; each cache is emptied when it reaches QUOTED_MAX entries.
 */
const quoted = new Map<string, string>();
const labels = new Map<string, string>();
const QUOTED_MAX = 4096;

function cached(cache: Map<string, string>, s: string, suffix: string): string {
  let q = cache.get(s);
  if (q === undefined) {
    q = JSON.stringify(s) + suffix;
    if (cache.size >= QUOTED_MAX) cache.clear();
    cache.set(s, q);
  }
  return q;
}

/** String(n) for 0 ≤ n < 1024 (rounds, indices, HP, amounts); -0 is 0 here too. */
const SMALL: readonly string[] = Array.from({ length: 1024 }, (_, n) => String(n));

/** The record's own keys sorted by UTF-16 code unit (`<` on strings), by insertion sort: records have a handful of keys. */
function sortedKeys(record: object): string[] {
  const keys = Object.keys(record);
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i] as string;
    let j = i - 1;
    for (; j >= 0 && (keys[j] as string) > k; j--) keys[j + 1] = keys[j] as string;
    keys[j + 1] = k;
  }
  return keys;
}

/**
 * Canonical JSON: object keys sorted by UTF-16 code unit, no whitespace,
 * safe integers only. Anything that is not plain JSON data throws TypeError.
 * Built by appending to one string (no per-level arrays): it runs over every event of every battle.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return cached(quoted, value, '');
    case 'number':
      if (!Number.isSafeInteger(value)) {
        throw new TypeError(`canonicalJson: non-integer or unsafe number ${String(value)}`);
      }
      return value >= 0 && value < SMALL.length ? (SMALL[value] as string) : String(value);
    case 'object': {
      if (Array.isArray(value)) {
        let out = '[';
        for (let i = 0; i < value.length; i++) out += (i === 0 ? '' : ',') + canonicalJson(value[i]);
        return out + ']';
      }
      const proto: unknown = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new TypeError('canonicalJson: only plain objects and arrays are allowed');
      }
      const record = value as Record<string, unknown>;
      const keys = sortedKeys(record);
      let out = '{';
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as string;
        out += (i === 0 ? '' : ',') + cached(labels, key, ':') + canonicalJson(record[key]);
      }
      return out + '}';
    }
    default:
      throw new TypeError(`canonicalJson: unsupported value of type ${typeof value}`);
  }
}

const UTF8 = new TextEncoder();

/** FNV-1a 64 over the UTF-8 bytes of the canonical JSON of the event array. */
export function eventStreamHash(events: readonly BattleEvent[]): string {
  return fnv1a64Hex(UTF8.encode(canonicalJson(events)));
}
