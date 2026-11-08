import { describe, expect, it } from 'vitest';
import { clonePlain } from '../../src/battle/clone.js';
import { SCENARIOS } from '../golden/scenarios.js';
import { BENCH_SETUPS } from '../scenarios/slice.js';

// clonePlain (B6): structuredClone's result for plain data, without its cost; structuredClone itself for anything else.

/** Every object reachable from `v`. */
function objects(v: unknown, out: Set<object> = new Set()): Set<object> {
  if (typeof v === 'object' && v !== null && !out.has(v)) {
    out.add(v);
    for (const x of Object.values(v)) objects(x, out);
  }
  return out;
}

describe('clonePlain', () => {
  it('copies every golden and bench setup exactly as structuredClone does, sharing no objects', () => {
    for (const setup of [...SCENARIOS.map((s) => s.setup), ...BENCH_SETUPS.map((s) => s.setup)]) {
      const copy = clonePlain(setup);
      expect(copy).toStrictEqual(structuredClone(setup));
      const mine = objects(copy);
      for (const o of objects(setup)) expect(mine.has(o)).toBe(false);
    }
  });

  it('keeps undefined values, -0, key order and null-prototype objects as plain objects', () => {
    const bare = Object.assign(Object.create(null) as object, { b: 1, a: [undefined, -0] });
    const v = { z: undefined, y: bare, x: 'x' };
    const copy = clonePlain(v);
    expect(copy).toStrictEqual(structuredClone(v));
    expect(Object.keys(copy)).toEqual(['z', 'y', 'x']);
    expect(Object.is((copy.y as { a: number[] }).a[1], -0)).toBe(true);
  });

  it('hands anything that is not plain data to structuredClone', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    const viaClone = clonePlain(cyclic);
    expect(viaClone.self).toBe(viaClone);
    const sparse = [1, , 3]; // eslint-disable-line no-sparse-arrays
    expect(1 in clonePlain(sparse)).toBe(false);
    const map = new Map([[1, 2]]);
    expect(clonePlain({ m: map }).m).toEqual(map);
    class Point {
      x = 1;
    }
    expect(Object.getPrototypeOf(clonePlain({ p: new Point() }).p)).toBe(Object.prototype);
    const own = JSON.parse('{"__proto__": {"polluted": true}}') as Record<string, unknown>;
    const copy = clonePlain(own);
    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
    expect(Object.keys(copy)).toEqual(['__proto__']);
    expect(() => clonePlain({ f: () => 1 })).toThrow(expect.objectContaining({ name: 'DataCloneError' }));
  });
});
