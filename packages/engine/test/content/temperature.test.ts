import { describe, expect, it } from 'vitest';
import { TEMPERATURE, hallucinationChancePct } from '../../src/content/temperature.js';

describe('temperature', () => {
  it('matches the bible table', () => {
    expect(TEMPERATURE[0]).toEqual({ rollMinPct: 100, rollMaxPct: 100, accMod: 10, baseCritStage: 0, selfHallucinationPct: 0, wild: false });
    expect(TEMPERATURE[1]).toEqual({ rollMinPct: 95, rollMaxPct: 105, accMod: 5, baseCritStage: 1, selfHallucinationPct: 0, wild: false });
    expect(TEMPERATURE[2]).toEqual({ rollMinPct: 85, rollMaxPct: 110, accMod: 0, baseCritStage: 2, selfHallucinationPct: 0, wild: false });
    expect(TEMPERATURE[3]).toEqual({ rollMinPct: 75, rollMaxPct: 125, accMod: -5, baseCritStage: 3, selfHallucinationPct: 5, wild: true });
    expect(TEMPERATURE[4]).toEqual({ rollMinPct: 60, rollMaxPct: 150, accMod: -15, baseCritStage: 4, selfHallucinationPct: 12, wild: true });
    expect(TEMPERATURE).toHaveLength(5);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TEMPERATURE)).toBe(true);
    expect(Object.isFrozen(TEMPERATURE[0])).toBe(true);
  });

  it('hallucinationChancePct', () => {
    expect(hallucinationChancePct(0, true)).toBe(12);
    expect(hallucinationChancePct(2, true)).toBe(25);
    expect(hallucinationChancePct(4, true)).toBe(62);
    expect(hallucinationChancePct(3, false)).toBe(5);
    expect(hallucinationChancePct(0, false)).toBe(0);
    expect(hallucinationChancePct(1, true)).toBe(25);
    expect(hallucinationChancePct(3, true)).toBe(55);
    expect(hallucinationChancePct(4, false)).toBe(12);
  });
});
