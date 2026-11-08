import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseSeed } from '../../src/rng/seed.js';
import { nextU32, seedRng } from '../../src/rng/sfc32.js';

function first4(hex: string): number[] {
  const p = parseSeed(hex);
  if (!p.ok) throw new Error('bad seed');
  const s = seedRng(p.words);
  return [nextU32(s), nextU32(s), nextU32(s), nextU32(s)];
}

describe('sfc32', () => {
  it('matches known answers (seed 1)', () => {
    expect(first4('00000000000000000000000000000001')).toEqual([
      0x514676c3, 0x08a809df, 0x30349d2b, 0xfb52c520,
    ]);
  });
  it('matches known answers (0123...)', () => {
    expect(first4('0123456789abcdef0123456789abcdef')).toEqual([
      0xd26e7837, 0xa333a754, 0x894ea5d8, 0x8ac3871b,
    ]);
  });
  it('seedRng returns plain data', () => {
    const s = seedRng([1, 2, 3, 4]);
    expect(Object.keys(s).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
  it('every output is a uint32 and state stays uint32', () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 0xffffffff }), { minLength: 4, maxLength: 4 }), (w) => {
        const s = seedRng([w[0]!, w[1]!, w[2]!, w[3]!]);
        for (let i = 0; i < 50; i++) {
          const v = nextU32(s);
          expect(Number.isInteger(v) && v >= 0 && v <= 0xffffffff).toBe(true);
        }
        for (const k of [s.a, s.b, s.c, s.d]) expect(k >= 0 && k <= 0xffffffff).toBe(true);
      }),
    );
  });
});
