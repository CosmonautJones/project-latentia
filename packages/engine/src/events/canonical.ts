import { fnv1a64Hex } from './fnv';
import type { BattleEvent } from './types';

// Module caches (quoted strings, key shapes, small integers) are bounded by entry count and never change the output.

/**
 * JSON.stringify of string values seen before (ids, event types). The vocabulary is small; the cache is emptied when it
 * reaches QUOTED_MAX entries.
 */
const quoted = new Map<string, string>();
const QUOTED_MAX = 4096;

function cachedQuote(s: string): string {
  let q = quoted.get(s);
  if (q === undefined) {
    q = JSON.stringify(s);
    if (quoted.size >= QUOTED_MAX) quoted.clear();
    quoted.set(s, q);
  }
  return q;
}

/** String(n) for 0 ≤ n < 1024 (rounds, indices, HP, amounts); -0 is 0 here too. */
const SMALL: readonly string[] = Array.from({ length: 1024 }, (_, n) => String(n));

/** The keys sorted by UTF-16 code unit (`<` on strings), by insertion sort: records have a handful of keys. */
function sortKeys(keys: readonly string[]): string[] {
  const out = [...keys];
  for (let i = 1; i < out.length; i++) {
    const k = out[i] as string;
    let j = i - 1;
    for (; j >= 0 && (out[j] as string) > k; j--) out[j + 1] = out[j] as string;
    out[j + 1] = k;
  }
  return out;
}

/**
 * Key shapes (C3.5): a trie over a record's own keys in insertion order (`Object.keys`), each node reached the first
 * time keeping that key list sorted and its labels — `"key":`, with a leading comma after the first. Events of a kind
 * share a few shapes, so sorting and quoting their keys happens once per shape, not once per event. It never changes
 * the output.
 *
 * Bounded by what it retains, not by node count (C3.5 m3): every node is one entry and every stored sorted key and
 * label is one more, so a node at depth d costs 1 + 2d. One record of n keys adds at most 3n entries, so the trie is
 * emptied first whenever that could take it past SHAPES_MAX, and a record wider than the whole bound (3n > SHAPES_MAX)
 * is sorted and labelled without being cached. Retention therefore never exceeds SHAPES_MAX entries for any input to
 * the public eventStreamHash, including adversarial prefix-key records (each key list a prefix of the next).
 */
type Shape = { next: Map<string, Shape>; sorted: string[] | null; labels: string[] | null };
export const SHAPES_MAX = 4096;
const newShape = (): Shape => ({ next: new Map(), sorted: null, labels: null });
let shapes = newShape();
let retained = 0;

/** Entries the trie retains: its nodes plus every stored sorted key and label (read by tests). */
export function shapeCacheEntries(): number {
  return retained;
}

function sortedLabels(keys: readonly string[]): { sorted: string[]; labels: string[] } {
  const sorted = sortKeys(keys);
  return { sorted, labels: sorted.map((k, i) => (i === 0 ? '' : ',') + JSON.stringify(k) + ':') };
}

function shapeOf(keys: readonly string[]): { sorted: string[]; labels: string[] } {
  const most = 3 * keys.length;
  if (most > SHAPES_MAX) return sortedLabels(keys);
  if (retained + most > SHAPES_MAX) {
    shapes = newShape();
    retained = 0;
  }
  let node = shapes;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i] as string;
    let child = node.next.get(k);
    if (child === undefined) {
      child = newShape();
      node.next.set(k, child);
      retained++;
    }
    node = child;
  }
  if (node.sorted === null || node.labels === null) {
    const made = sortedLabels(keys);
    node.sorted = made.sorted;
    node.labels = made.labels;
    retained += 2 * keys.length;
  }
  return node as Shape & { sorted: string[]; labels: string[] };
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
      return cachedQuote(value);
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
      const shape = shapeOf(Object.keys(record));
      let out = '{';
      for (let i = 0; i < shape.sorted.length; i++) out += (shape.labels[i] as string) + canonicalJson(record[shape.sorted[i] as string]);
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
