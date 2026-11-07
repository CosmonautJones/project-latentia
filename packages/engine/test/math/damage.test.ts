import { describe, expect, it } from 'vitest';
import { computeDamage, effectivePower, type DamageMods } from '../../src/math/damage.js';

const base = { power: 60, atk: 11, def: 11, level: 5 };

describe('computeDamage', () => {
  it('baseline L5 damage', () => {
    expect(computeDamage({ ...base, mods: {} })).toBe(5);
  });
  it('a 10% modifier changes L5 damage (spec requirement)', () => {
    expect(computeDamage({ ...base, mods: { handoff: 11000 } })).toBe(6);
  });
  it('native same-type', () => {
    expect(computeDamage({ ...base, mods: { native: 12500 } })).toBe(7);
  });
  it('type and crit combine', () => {
    expect(computeDamage({ ...base, mods: { type: 20000, crit: 15000 } })).toBe(15);
  });
  it('floors after each modifier in spec order', () => {
    // d = 48000; type 3333 -> 15998 (floor); refusal 5000 -> 7999; damage 0 + 1.
    expect(computeDamage({ ...base, mods: { type: 3333, refusalOrApology: 5000 } })).toBe(1);
  });
  it('clamps the type multiplier to 2500..30000', () => {
    const hi = computeDamage({ ...base, mods: { type: 90000 } });
    expect(hi).toBe(computeDamage({ ...base, mods: { type: 30000 } }));
    const lo = computeDamage({ ...base, mods: { type: 1 } });
    expect(lo).toBe(computeDamage({ ...base, mods: { type: 2500 } }));
  });
  it('does not throw with every modifier at its max', () => {
    const mods: DamageMods = {
      type: 30000,
      t4se: 12500,
      native: 12500,
      crit: 15000,
      roll: 12500,
      handoff: 13000,
      specialist: 11500,
      overfit: 11500,
      glazed: 7000,
      observation: 9000,
      guard: 5000,
      refusalOrApology: 7000,
    };
    expect(() => computeDamage({ power: 300, atk: 533, def: 2, level: 100, mods })).not.toThrow();
  });
});

describe('effectivePower', () => {
  const i = { base: 60, additive: 20, conditional: [20000], toolSteps: 1, summary: false };
  it('applies additive, conditional, tool steps', () => {
    expect(effectivePower(i)).toBe(176);
  });
  it('halves with Compaction Summary', () => {
    expect(effectivePower({ ...i, summary: true })).toBe(88);
  });
});
