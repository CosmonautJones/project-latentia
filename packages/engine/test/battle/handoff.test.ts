import { describe, expect, it } from 'vitest';
import { extendChain, handoffBp, HANDOFF_MAX_BP, HANDOFF_STEP_BP } from '../../src/battle/handoff.js';
import type { BattleEvent } from '../../src/events/types.js';
import { battle } from './helpers.js';

describe('handoffBp (Ruling 97)', () => {
  it('pins the constants: +15% per earlier hit, capped at +30%', () => {
    expect([HANDOFF_STEP_BP, HANDOFF_MAX_BP]).toEqual([1500, 13000]);
  });

  it('1st hit takes no modifier; 2nd 11500; 3rd and every later hit 13000', () => {
    const s = battle();
    const events: BattleEvent[] = [];
    const seen: (number | null)[] = [];
    for (const actor of [0, 1, 2, 0, 1]) {
      seen.push(handoffBp(s, 'a', 8));
      extendChain(s, actor, 'a', 8, 1, events);
    }
    expect(seen).toEqual([null, 11500, 13000, 13000, 13000]);
  });

  it("another side's chain on the target gives no modifier", () => {
    const s = battle();
    extendChain(s, 7, 'b', 1, 1, []);
    expect(handoffBp(s, 'a', 1)).toBeNull();
  });
});
