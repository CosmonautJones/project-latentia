import { describe, expect, it } from 'vitest';
import { effectiveStat, hpAt, levelFactor, statAt } from '../../src/math/stats.js';

describe('stats', () => {
  it('statAt / hpAt', () => {
    expect(statAt(60, 5)).toBe(11);
    expect(hpAt(60, 5)).toBe(21);
  });
  it('levelFactor', () => {
    expect(levelFactor(5)).toBe(4);
    expect(levelFactor(20)).toBe(10);
  });
  it('effectiveStat applies stage basis points', () => {
    expect(effectiveStat(100, 1)).toBe(125);
    expect(effectiveStat(100, -1)).toBe(80);
    expect(effectiveStat(100, -3)).toBe(57);
  });
});
