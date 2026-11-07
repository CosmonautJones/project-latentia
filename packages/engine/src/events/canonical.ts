import { fnv1a64Hex } from './fnv';
import type { BattleEvent } from './types';

/**
 * Canonical JSON: object keys sorted by UTF-16 code unit, no whitespace,
 * safe integers only. Anything that is not plain JSON data throws TypeError.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isSafeInteger(value)) {
        throw new TypeError(`canonicalJson: non-integer or unsafe number ${String(value)}`);
      }
      return value === 0 ? '0' : String(value);
    case 'object': {
      if (Array.isArray(value)) {
        return '[' + value.map((item) => canonicalJson(item)).join(',') + ']';
      }
      const proto: unknown = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new TypeError('canonicalJson: only plain objects and arrays are allowed');
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      const parts: string[] = [];
      for (const key of keys) {
        parts.push(JSON.stringify(key) + ':' + canonicalJson(record[key]));
      }
      return '{' + parts.join(',') + '}';
    }
    default:
      throw new TypeError(`canonicalJson: unsupported value of type ${typeof value}`);
  }
}

/** FNV-1a 64 over the UTF-8 bytes of the canonical JSON of the event array. */
export function eventStreamHash(events: readonly BattleEvent[]): string {
  return fnv1a64Hex(new TextEncoder().encode(canonicalJson(events)));
}
