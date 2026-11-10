import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalJson, eventStreamHash, SHAPES_MAX, shapeCacheEntries } from '../../src/events/canonical';
import { fnv1a64Hex } from '../../src/events/fnv';
import type { BattleEvent } from '../../src/events/types';

// canonicalJson sorts and quotes each key shape once (C3.5 key-shape trie): it must give exactly what the plain
// algorithm gives — every key list sorted by UTF-16 code unit and JSON.stringify'd — for any data, any key order, any
// number of shapes (past the trie's bound, so it is emptied mid-run), and throw where it throws.

function reference(v: unknown): string {
  if (v === null || typeof v !== 'object') return typeof v === 'number' ? String(v === 0 ? 0 : v) : JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(reference).join(',')}]`;
  const keys = Object.keys(v).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  return `{${keys.map((k) => `${JSON.stringify(k)}:${reference((v as Record<string, unknown>)[k])}`).join(',')}}`;
}

const text = fc.oneof(fc.string(), fc.string({ unit: 'binary' }), fc.constantFrom('', 'a', 'B', '\ud800', '😀', 'é"\\\n', '__proto__', 'constructor'));
const int = fc.oneof(fc.integer({ min: -2000, max: 2000 }), fc.maxSafeInteger(), fc.constant(-0));
const json = fc.letrec((tie) => ({
  value: fc.oneof({ depthSize: 'small' }, fc.constant(null), fc.boolean(), int, text, tie('array'), tie('object')),
  array: fc.array(tie('value'), { maxLength: 6 }),
  object: fc.dictionary(text, tie('value'), { maxKeys: 6 }),
})).value;

/** The same entries inserted in another order. */
const reordered = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(o).reverse());

describe('canonicalJson key shapes (C3.5)', () => {
  it('equals the plain algorithm for any data', () => {
    fc.assert(
      fc.property(json, (v) => {
        expect(canonicalJson(v)).toBe(reference(v));
      }),
      { numRuns: 3000 },
    );
  });

  it('is independent of insertion order, shape after shape, past the trie bound', () => {
    for (let i = 0; i < 6000; i++) {
      const o: Record<string, unknown> = { [`k${i}`]: i, z: [i], a: { [`n${i % 7}`]: true, b: null } };
      const want = reference(o);
      expect(canonicalJson(o)).toBe(want);
      expect(canonicalJson(reordered(o))).toBe(want);
    }
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({})).toBe('{}');
  });

  it('hashes the same bytes: eventStreamHash is the FNV-1a of the canonical UTF-8', () => {
    const enc = new TextEncoder();
    fc.assert(
      fc.property(fc.array(json, { maxLength: 5 }), (events) => {
        expect(eventStreamHash(events as BattleEvent[])).toBe(fnv1a64Hex(enc.encode(reference(events))));
      }),
      { numRuns: 500 },
    );
  });
});

describe('canonicalJson key-shape trie bound (C3.5 m3)', () => {
  // Adversarial prefix-key records: every key list is a prefix of the next, so the trie gains one node per record
  // while each new node stores a key list as long as the record. Counting nodes alone would retain O(n²) labels.
  const prefixRecord = (n: number): Record<string, number> => Object.fromEntries(Array.from({ length: n }, (_, i) => [`key${i}`, i]));

  it('retains at most SHAPES_MAX entries (nodes plus stored keys and labels) for prefix-key records', () => {
    for (let n = 1; n <= 400; n++) {
      const o = prefixRecord(n);
      expect(canonicalJson(o)).toBe(reference(o));
      expect(shapeCacheEntries()).toBeLessThanOrEqual(SHAPES_MAX);
    }
  });

  it('retains at most SHAPES_MAX entries after one record wider than the bound, and still gives the canonical text', () => {
    const wide = prefixRecord(SHAPES_MAX + 10);
    expect(canonicalJson(wide)).toBe(reference(wide));
    expect(shapeCacheEntries()).toBeLessThanOrEqual(SHAPES_MAX);
    expect(canonicalJson(reordered(wide))).toBe(reference(wide));
    expect(shapeCacheEntries()).toBeLessThanOrEqual(SHAPES_MAX);
  });

  it('still caches ordinary shapes (an event-sized record is retained)', () => {
    canonicalJson({ type: 'Damage', round: 1, actor: 0 });
    expect(shapeCacheEntries()).toBeGreaterThan(0);
  });
});
