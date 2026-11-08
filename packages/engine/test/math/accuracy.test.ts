import { describe, expect, it } from 'vitest';
import { CRIT_THRESHOLDS_48, critThreshold, hitChance } from '../../src/math/accuracy.js';

const z = { moveAcc: 100, tempMod: 0, drift: 0, accStages: 0, evaStages: 0, robustBonus: 0 };

describe('hitChance', () => {
  it('combines temperature and drift', () => {
    expect(hitChance({ ...z, tempMod: -15, drift: 5 })).toBe(45);
  });
  it('clamps to 30..100', () => {
    expect(hitChance({ ...z, drift: 5, tempMod: -40 })).toBe(30);
    expect(hitChance({ ...z, accStages: 3, tempMod: 20 })).toBe(100);
  });
  it('robustBonus adds 5', () => {
    expect(hitChance({ ...z, tempMod: -15, drift: 5, robustBonus: 5 })).toBe(50);
  });
  it('stages are acc minus eva, 10 each', () => {
    expect(hitChance({ ...z, moveAcc: 80, accStages: 1, evaStages: 3 })).toBe(60);
  });
});

describe('critThreshold', () => {
  it('maps stages and caps at 6', () => {
    expect(CRIT_THRESHOLDS_48).toEqual([0, 1, 2, 4, 8, 24, 48]);
    expect(critThreshold(0)).toBe(0);
    expect(critThreshold(4)).toBe(8);
    expect(critThreshold(9)).toBe(48);
    expect(critThreshold(-2)).toBe(0);
  });
});
