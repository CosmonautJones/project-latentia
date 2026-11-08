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
    // d = floor(300 × 533 × 42 × 10000 / 100) = 671580000, then each modifier floored in spec order.
    expect(computeDamage({ power: 300, atk: 533, def: 2, level: 100, mods })).toBe(223763);
  });
});

describe('computeDamage modifier order (spec §5 step 4, pinned pair by pair)', () => {
  type Key = keyof DamageMods;
  const SPEC_ORDER: readonly Key[] = ['type', 't4se', 'native', 'crit', 'roll', 'handoff', 'specialist', 'overfit', 'glazed', 'observation', 'guard', 'refusalOrApology'];

  /** Damage with the given modifiers applied in the given order, each floored (an independent reference). */
  function byHand(power: number, atk: number, def: number, level: number, mods: readonly [Key, number][]): number {
    let d = Math.floor((power * atk * (Math.floor((2 * level) / 5) + 2) * 10000) / (def * 50));
    for (const [, m] of mods) d = Math.floor((d * m) / 10000);
    return Math.floor(d / 10000) + 1;
  }

  // One case per adjacent pair whose floors differ when the two are swapped:
  // [first, its bp, second, its bp, power, atk, def, level, damage in spec order, damage swapped].
  // t4se and native are both 12500, so swapping them can never change a result: that pair is pinned
  // through its neighbours only.
  const CASES: readonly [Key, number, Key, number, number, number, number, number, number, number][] = [
    ['type', 30000, 't4se', 12500, 21, 109, 103, 10, 11, 10],
    ['native', 12500, 'crit', 15000, 21, 109, 103, 10, 5, 6],
    ['crit', 15000, 'roll', 11300, 21, 223, 127, 5, 6, 5],
    ['roll', 11300, 'handoff', 13000, 59, 15, 26, 5, 4, 5],
    ['handoff', 13000, 'specialist', 11500, 24, 108, 31, 5, 11, 10],
    ['specialist', 11500, 'overfit', 7000, 34, 211, 66, 5, 8, 7],
    ['overfit', 11500, 'glazed', 7000, 34, 211, 66, 5, 8, 7],
    ['glazed', 7000, 'observation', 9000, 26, 29, 19, 5, 2, 3],
    ['observation', 9000, 'guard', 5000, 149, 11, 59, 5, 2, 1],
    ['guard', 5000, 'refusalOrApology', 7000, 43, 201, 121, 5, 2, 3],
  ];

  it.each(CASES)('%s (%i) before %s (%i)', (k1, v1, k2, v2, power, atk, def, level, inOrder, swapped) => {
    expect(SPEC_ORDER.indexOf(k2)).toBe(SPEC_ORDER.indexOf(k1) + 1);
    expect(byHand(power, atk, def, level, [[k1, v1], [k2, v2]])).toBe(inOrder);
    expect(byHand(power, atk, def, level, [[k2, v2], [k1, v1]])).toBe(swapped);
    expect(computeDamage({ power, atk, def, level, mods: { [k1]: v1, [k2]: v2 } })).toBe(inOrder);
  });

  it('covers every adjacent pair but the indistinguishable t4se/native', () => {
    expect(CASES.map((c) => c[0])).toEqual(SPEC_ORDER.slice(0, -1).filter((k) => k !== 't4se'));
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
