import { describe, expect, it } from 'vitest';
import { drawAction, drawRoundStart, hi, lo } from '../../src/rng/draws.js';
import { nextU32, seedRng } from '../../src/rng/sfc32.js';

describe('draws', () => {
  it('lo/hi split the word', () => {
    expect(lo(0xabcd1234, 100)).toBe(0x1234 % 100);
    expect(hi(0xabcd1234, 100)).toBe(0xabcd % 100);
  });
  it('drawAction consumes exactly six outputs in order', () => {
    const s = seedRng([1, 2, 3, 4]);
    const c = { ...s };
    const d = drawAction(s);
    const expected = [1, 2, 3, 4, 5, 6].map(() => nextU32(c));
    expect([d.d1, d.d2, d.d3, d.d4, d.d5, d.d6]).toEqual(expected);
    expect(s).toEqual(c);
  });
  it('drawRoundStart consumes exactly two outputs in order', () => {
    const s = seedRng([1, 2, 3, 4]);
    const c = { ...s };
    const d = drawRoundStart(s);
    expect([d.r1, d.r2]).toEqual([nextU32(c), nextU32(c)]);
    expect(s).toEqual(c);
  });
  it('lo/hi accept every modulus 1..65536', () => {
    expect(lo(0xabcd1234, 1)).toBe(0);
    expect(hi(0xabcd1234, 1)).toBe(0);
    expect(lo(0xabcd1234, 65536)).toBe(0x1234);
    expect(hi(0xabcd1234, 65536)).toBe(0xabcd);
  });
  it('lo/hi throw a plain RangeError (rng stays dependency-free) for a modulus that is not a safe integer in 1..65536', () => {
    for (const m of [0, -1, 65537, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => lo(0xabcd1234, m)).toThrow(RangeError);
      expect(() => hi(0xabcd1234, m)).toThrow(RangeError);
    }
  });
});
