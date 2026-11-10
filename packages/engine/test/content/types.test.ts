import { describe, expect, it } from 'vitest';
import { TYPES, type TypeId } from '../../src/content/ids.js';
import { mulBp } from '../../src/math/bp.js';
import { TYPE_CHART_BP, TYPE_MULT_MAX_BP, TYPE_MULT_MIN_BP, typeMultiplierBp } from '../../src/content/types.js';

// Bible order: Rea, Spd, Opn, Cod, Vis, Voi, Sea, Mem. Rows = attacker, columns = defender.
const X = 15000;
const H = 6667;
const N = 10000;
const BIBLE: Record<TypeId, number[]> = {
  reasoning: [N, H, X, X, N, N, N, H],
  speed: [X, N, H, N, H, N, X, N],
  open: [H, X, N, N, H, X, N, N],
  code: [H, N, N, N, X, N, H, X],
  vision: [N, X, X, H, N, H, N, N],
  voice: [N, N, H, N, X, N, X, H],
  search: [N, H, N, X, N, H, N, X],
  memory: [X, N, N, H, N, X, H, N],
};

describe('type chart', () => {
  it('has the bible type order', () => {
    expect(TYPES).toEqual(['reasoning', 'speed', 'open', 'code', 'vision', 'voice', 'search', 'memory']);
  });

  const cells = TYPES.flatMap((a, i) => TYPES.map((d, j) => [a, d, (BIBLE[a] as number[])[j] as number, i, j] as const));
  it.each(cells)('%s -> %s', (a, d, expected) => {
    expect(typeMultiplierBp(a, [d])).toBe(expected);
    expect(TYPE_CHART_BP[a][d]).toBe(expected);
  });

  it('spot checks', () => {
    expect(typeMultiplierBp('speed', ['reasoning'])).toBe(15000);
    expect(typeMultiplierBp('reasoning', ['speed'])).toBe(6667);
    expect(typeMultiplierBp('memory', ['reasoning'])).toBe(15000);
    expect(typeMultiplierBp('open', ['speed'])).toBe(15000);
  });

  it('every row and column has exactly two 1.5x and two 2/3', () => {
    for (const t of TYPES) {
      const row = TYPES.map((d) => TYPE_CHART_BP[t][d]);
      const col = TYPES.map((a) => TYPE_CHART_BP[a][t]);
      for (const line of [row, col]) {
        expect(line.filter((v) => v === 15000)).toHaveLength(2);
        expect(line.filter((v) => v === 6667)).toHaveLength(2);
      }
    }
  });

  it('dual types multiply with mulBp flooring, and the bounds are the exact extremes (Ruling 148)', () => {
    // mulBp(N, a) = a, then mulBp(a, b) = floor(a * b / 10000), so the product floors once.
    expect(typeMultiplierBp('speed', ['reasoning', 'search'])).toBe(22500); // 15000 x 15000
    expect(typeMultiplierBp('reasoning', ['speed', 'memory'])).toBe(4444); // 6667 x 6667 = 4444.8889, floored
    expect(typeMultiplierBp('speed', ['reasoning', 'speed'])).toBe(15000); // 15000 x 10000
    expect(typeMultiplierBp('reasoning', ['speed', 'open'])).toBe(10000); // 6667 x 15000 = 10000.5, floored
    expect(typeMultiplierBp('reasoning', ['open', 'speed'])).toBe(10000); // same product in the other order
    expect(TYPE_MULT_MAX_BP).toBe(22500);
    expect(TYPE_MULT_MIN_BP).toBe(4444);
  });

  it('no dual-type product over the whole chart leaves the bounds, and both bounds are reached', () => {
    const all: number[] = [];
    for (const a of TYPES) {
      for (const d1 of TYPES) for (const d2 of TYPES) if (d1 !== d2) all.push(typeMultiplierBp(a, [d1, d2]));
    }
    expect(Math.min(...all)).toBe(TYPE_MULT_MIN_BP);
    expect(Math.max(...all)).toBe(TYPE_MULT_MAX_BP);
    // the clamp is a no-op: the unclamped product is already inside the bounds
    for (const a of TYPES) {
      for (const d1 of TYPES) {
        for (const d2 of TYPES) {
          if (d1 === d2) continue;
          const raw = mulBp(mulBp(10000, TYPE_CHART_BP[a][d1]), TYPE_CHART_BP[a][d2]);
          expect(raw).toBe(typeMultiplierBp(a, [d1, d2]));
        }
      }
    }
  });
});
