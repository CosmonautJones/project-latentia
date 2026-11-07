import { describe, expect, it } from 'vitest';
import { assertInvariants } from '../../src/battle/invariants.js';
import { autofillBench, checkEnd, ROUND_CAP, winOutcome } from '../../src/battle/end.js';
import { submitRound } from '../../src/battle/round.js';
import type { BattleEvent } from '../../src/events/types.js';
import type { BattleState, SideId } from '../../src/battle/state.js';
import { at, battle, faint, mon } from './helpers.js';

const placement = (s: BattleState, i: number) => {
  const c = at(s, i);
  return [c.slot, c.activeSlot, c.benchOrder];
};

const slot = (s: BattleState, side: SideId, i: number) => {
  const x = s.sides[side].slots[i];
  if (x === undefined) throw new Error('slot');
  return x;
};

describe('autofillBench', () => {
  it('fills a slot whose occupant fainted with the first living bench creature in bench order', () => {
    const s = battle();
    faint(at(s, 1)); // a-act1 in slot 0
    faint(at(s, 3)); // a-b1, bench order 0
    const events = autofillBench(s, 4);
    expect(events).toEqual([{ round: 4, type: 'Swapped', side: 0, outIndex: 1, inIndex: 4 }]);
    expect(slot(s, 'a', 0).occupant).toBe(4);
    expect(placement(s, 4)).toEqual(['active', 0, null]);
    // The fainted creature goes to the end of the bench; the rest are re-numbered contiguously.
    expect(placement(s, 3)).toEqual(['bench', null, 0]);
    expect(placement(s, 5)).toEqual(['bench', null, 1]);
    expect(placement(s, 1)).toEqual(['bench', null, 2]);
    assertInvariants(s);
  });

  it('fills empty slots in slot order, each taking the next living bench creature', () => {
    const s = battle({ active: [] });
    // a: 0 orch, 1-3 bench; b: 4 orch, 5-6 active, 7-9 bench
    const events = autofillBench(s, 1);
    expect(events).toEqual([
      { round: 1, type: 'Swapped', side: 0, outIndex: -1, inIndex: 1 },
      { round: 1, type: 'Swapped', side: 0, outIndex: -1, inIndex: 2 },
    ]);
    expect(placement(s, 1)).toEqual(['active', 0, null]);
    expect(placement(s, 2)).toEqual(['active', 1, null]);
    expect(placement(s, 3)).toEqual(['bench', null, 0]);
    assertInvariants(s);
  });

  it('fills side B too, after side A', () => {
    const s = battle();
    faint(at(s, 8));
    faint(at(s, 2));
    expect(autofillBench(s, 2).map((e) => e.type === 'Swapped' && [e.side, e.outIndex, e.inIndex])).toEqual([
      [0, 2, 3],
      [1, 8, 9],
    ]);
    assertInvariants(s);
  });

  it('leaves the fainted occupant in place when no living bench creature remains', () => {
    const s = battle({ bench: [mon('a-b1', 'tokenibble')] });
    faint(at(s, 1));
    faint(at(s, 3));
    expect(autofillBench(s, 1)).toEqual([]);
    expect(slot(s, 'a', 0).occupant).toBe(1);
    expect(placement(s, 1)).toEqual(['active', 0, null]);
  });

  it('never fills a removed slot or a gridded side\'s absent slot', () => {
    const s = battle();
    faint(at(s, 1));
    faint(at(s, 2));
    slot(s, 'a', 0).pieceId = 'slot1';
    at(s, 0).context.removedSlots.push('slot1');
    s.sides.a.grid = { width: 5, height: 4, pieces: [] }; // gridded: slot 1 has pieceId null, so it does not exist
    expect(autofillBench(s, 1)).toEqual([]);
  });

  it('does nothing when every slot holds a living creature', () => {
    expect(autofillBench(battle(), 1)).toEqual([]);
  });
});

describe('checkEnd (win check)', () => {
  const wipe = (s: BattleState, side: SideId) => s.creatures.filter((c) => c.side === side).forEach(faint);

  it('returns nothing while both sides have a living creature', () => {
    const s = battle();
    faint(at(s, 0));
    faint(at(s, 1));
    faint(at(s, 2)); // side A still has its bench
    expect(checkEnd(s)).toEqual([]);
    expect(s.ended).toBe(false);
    expect(s.result).toBeNull();
  });

  it('ends with the other side winning when every creature on one side is KO\'d', () => {
    const s = battle();
    s.round = 7;
    wipe(s, 'b');
    expect(checkEnd(s)).toEqual([{ round: 7, type: 'BattleEnd', winner: 0, reason: 'knockout' }]);
    expect(s.ended).toBe(true);
    expect(s.result).toBe('a');
  });

  it('gives side B the win when side A is wiped', () => {
    const s = battle();
    wipe(s, 'a');
    expect(checkEnd(s)).toEqual([{ round: 0, type: 'BattleEnd', winner: 1, reason: 'knockout' }]);
    expect(s.result).toBe('b');
  });

  it('winOutcome decides without emitting or ending the battle', () => {
    const s = battle();
    expect(winOutcome(s)).toBeNull();
    wipe(s, 'a');
    expect(winOutcome(s)).toBe('b');
    wipe(s, 'b');
    expect(winOutcome(s)).toBe('draw');
    expect(s.ended).toBe(false);
    expect(s.result).toBeNull();
  });

  it('a knockout at round 50 is a knockout, not a cap result', () => {
    const s = battle();
    s.round = ROUND_CAP;
    wipe(s, 'b');
    expect(checkEnd(s)).toEqual([{ round: 50, type: 'BattleEnd', winner: 0, reason: 'knockout' }]);
  });

  it('is a draw when both sides are wiped', () => {
    const s = battle();
    wipe(s, 'a');
    wipe(s, 'b');
    expect(checkEnd(s)).toEqual([{ round: 0, type: 'BattleEnd', winner: null, reason: 'knockout' }]);
    expect(s.result).toBe('draw');
  });
});

describe('checkEnd: round-50 cap', () => {
  /** Side A: 0-5, side B: 6-11 in the default battle; every creature's maxHp is set to `max`. */
  const capped = (maxA: number, maxB: number): BattleState => {
    const s = battle();
    s.round = ROUND_CAP;
    for (const c of s.creatures) {
      c.maxHp = c.side === 'a' ? maxA : maxB;
      c.hp = c.maxHp;
    }
    return s;
  };

  it('is 50', () => {
    expect(ROUND_CAP).toBe(50);
  });

  it('does nothing before the cap', () => {
    const s = capped(100, 100);
    s.round = ROUND_CAP - 1;
    at(s, 6).hp = 1;
    expect(checkEnd(s)).toEqual([]);
    expect(s.ended).toBe(false);
  });

  it('a 1-HP difference decides it: sumHpA * sumMaxB > sumHpB * sumMaxA → A wins', () => {
    const s = capped(100, 100);
    at(s, 7).hp = 99;
    expect(checkEnd(s)).toEqual([{ round: 50, type: 'BattleEnd', winner: 0, reason: 'cap' }]);
    expect(s.result).toBe('a');
    expect(s.ended).toBe(true);
  });

  it('a 1-HP difference the other way → B wins', () => {
    const s = capped(100, 100);
    at(s, 3).hp = 99; // bench HP counts too
    expect(checkEnd(s)).toEqual([{ round: 50, type: 'BattleEnd', winner: 1, reason: 'cap' }]);
    expect(s.result).toBe('b');
  });

  it('compares HP ratios, not raw HP: equal ratios are an exact tie → draw', () => {
    const s = capped(20, 40);
    for (const c of s.creatures) c.hp = c.side === 'a' ? 10 : 20; // 60/120 vs 120/240
    expect(checkEnd(s)).toEqual([{ round: 50, type: 'BattleEnd', winner: null, reason: 'cap' }]);
    expect(s.result).toBe('draw');
  });

  it('larger raw HP loses when its ratio is lower', () => {
    const s = capped(20, 40);
    for (const c of s.creatures) c.hp = c.side === 'a' ? 10 : 19; // 60*240 = 14400 > 114*120 = 13680
    expect(checkEnd(s)).toEqual([{ round: 50, type: 'BattleEnd', winner: 0, reason: 'cap' }]);
  });

  it('does nothing when the battle already ended', () => {
    const s = capped(100, 100);
    s.ended = true;
    s.result = 'b';
    expect(checkEnd(s)).toEqual([]);
    expect(s.result).toBe('b');
  });
});

describe('end of round: status ticks and Deprecated (Ruling 21)', () => {
  /** Every creature at 500/500 HP; every orchestrator does nothing. */
  const sturdy = (...args: Parameters<typeof battle>): BattleState => {
    const s = battle(...args);
    for (const c of s.creatures) c.hp = c.maxHp = 500;
    return s;
  };
  const round = (s: BattleState): { state: BattleState; events: BattleEvent[] } => {
    const none = { temperature: 2 as const, action: { kind: 'none' as const } };
    const r = submitRound(s, { a: none, b: none });
    if ('error' in r) throw new Error(r.error.message);
    return r;
  };
  const after = (events: BattleEvent[], type: BattleEvent['type']) => events.slice(events.map((e) => e.type).lastIndexOf('ActionStarted')).filter((e) => e.type === type);

  it('ticks statuses after the last action, before RoundEnd', () => {
    const s = sturdy();
    at(s, 7).statuses.push({ id: 'glazed', remaining: 1, source: 1 }, { id: 'quantized', remaining: 2 });
    const { state, events } = round(s);
    expect(after(events, 'StatusExpired')).toEqual([{ round: 1, type: 'StatusExpired', target: 7, status: 'glazed' }]);
    expect(at(state, 7).statuses).toEqual([{ id: 'quantized', remaining: 1 }]);
    expect(events.findIndex((e) => e.type === 'StatusExpired')).toBeLessThan(events.findIndex((e) => e.type === 'RoundEnd'));
  });

  it('Deprecated at 0 force-benches a subagent at 1 HP to the END of the bench; auto-fill brings in the first living one', () => {
    const s = sturdy();
    at(s, 1).statuses.push({ id: 'deprecated', remaining: 1 });
    const { state, events } = round(s);
    expect(after(events, 'Swapped')).toEqual([
      { round: 1, type: 'Swapped', side: 0, outIndex: 1, inIndex: -1 },
      { round: 1, type: 'Swapped', side: 0, outIndex: -1, inIndex: 3 },
    ]);
    expect(after(events, 'StatusExpired')).toEqual([]);
    expect(at(state, 1)).toMatchObject({ hp: 1, fainted: false, slot: 'bench', benchOrder: 2, statuses: [] });
    expect([4, 5].map((i) => at(state, i).benchOrder)).toEqual([0, 1]);
    expect(state.sides.a.slots[0]?.occupant).toBe(3);
    assertInvariants(state);
  });

  it('Deprecated at 0 KOs a subagent with no living bench creature, and an orchestrator (Headless Mode)', () => {
    const noBench = sturdy({ bench: [] });
    at(noBench, 1).statuses.push({ id: 'deprecated', remaining: 1 });
    const r1 = round(noBench);
    expect(after(r1.events, 'Fainted')).toEqual([{ round: 1, type: 'Fainted', target: 1 }]);
    expect(at(r1.state, 1)).toMatchObject({ hp: 0, fainted: true, slot: 'active' });

    const orch = sturdy();
    at(orch, 6).statuses.push({ id: 'deprecated', remaining: 1 });
    const r2 = round(orch);
    expect(after(r2.events, 'Fainted')).toEqual([{ round: 1, type: 'Fainted', target: 6 }]);
    expect(after(r2.events, 'HeadlessMode')).toEqual([{ round: 1, type: 'HeadlessMode', side: 1, active: true }]);
    expect(r2.state.sides.b.headless).toBe(true);
  });

  it('a Deprecated KO that wipes a side ends the battle after RoundEnd', () => {
    const s = sturdy({}, { active: [], bench: [] });
    at(s, 6).statuses.push({ id: 'deprecated', remaining: 1 }); // b is its orchestrator alone (index 6)
    const { events } = round(s);
    expect(events.slice(-2)).toEqual([
      { round: 1, type: 'RoundEnd' },
      { round: 1, type: 'BattleEnd', winner: 0, reason: 'knockout' },
    ]);
  });
});
