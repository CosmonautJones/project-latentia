import { describe, expect, it } from 'vitest';
import { TYPES, type TypeId } from '../../src/content/ids.js';
import { TYPE_CHART_BP, typeMultiplierBp } from '../../src/content/types.js';

// Bible order: Rea, Spd, Opn, Cod, Vis, Voi, Sea, Mem. Rows = attacker, columns = defender.
const X = 20000;
const H = 5000;
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
    expect(typeMultiplierBp('speed', ['reasoning'])).toBe(20000);
    expect(typeMultiplierBp('reasoning', ['speed'])).toBe(5000);
    expect(typeMultiplierBp('memory', ['reasoning'])).toBe(20000);
    expect(typeMultiplierBp('open', ['speed'])).toBe(20000);
  });

  it('every row and column has exactly two 2x and two 1/2', () => {
    for (const t of TYPES) {
      const row = TYPES.map((d) => TYPE_CHART_BP[t][d]);
      const col = TYPES.map((a) => TYPE_CHART_BP[a][t]);
      for (const line of [row, col]) {
        expect(line.filter((v) => v === 20000)).toHaveLength(2);
        expect(line.filter((v) => v === 5000)).toHaveLength(2);
      }
    }
  });

  it('dual types multiply and clamp to 2500..30000', () => {
    expect(typeMultiplierBp('speed', ['reasoning', 'search'])).toBe(30000);
    expect(typeMultiplierBp('reasoning', ['speed', 'memory'])).toBe(2500);
    expect(typeMultiplierBp('speed', ['reasoning', 'speed'])).toBe(20000);
  });
});
