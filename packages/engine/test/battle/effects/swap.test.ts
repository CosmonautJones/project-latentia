import { describe, expect, it } from 'vitest';
import { assertInvariants } from '../../../src/battle/invariants.js';
import type { RoundCommand } from '../../../src/battle/log.js';
import { submitRound } from '../../../src/battle/round.js';
import type { BattleState } from '../../../src/battle/state.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { at, battle, mon } from '../helpers.js';
import { fresh, ofType, run } from './kit.js';

function ok(s: BattleState, cmd: RoundCommand): { state: BattleState; events: BattleEvent[] } {
  const r = submitRound(s, cmd);
  if ('error' in r) throw new Error(r.error.message);
  return r;
}

const swap = (out: number, inc: number): RoundCommand => ({ a: { temperature: 2, action: { kind: 'swap', out, in: inc } } });

/** The default battle with every creature at 500/500 HP, so no KO (and no auto-fill) muddies the slots. */
function sturdy(...args: Parameters<typeof battle>): BattleState {
  const s = battle(...args);
  for (const c of s.creatures) c.hp = c.maxHp = 500;
  return s;
}

describe('Swap (orchestrator lever, priority +3)', () => {
  it('resolves before a +1 move; the swapped-in creature does not act this round and the swapped-out one skips', () => {
    const s = sturdy({}, { orchestrator: mon('b-orch', 'blitzr') });
    const { state, events } = ok(s, { ...swap(1, 4), b: { temperature: 2, action: { kind: 'move', moveId: 'token-burst', target: 2 } } });
    const swapped = events.findIndex((e) => e.type === 'Swapped');
    const burst = events.findIndex((e) => e.type === 'MoveUsed' && e.moveId === 'token-burst');
    expect(events[swapped]).toEqual({ round: 1, type: 'Swapped', side: 0, outIndex: 1, inIndex: 4 });
    expect(burst).toBeGreaterThan(swapped);
    expect(ofType(events, 'ActionStarted').map((e) => e.actor)).not.toContain(4);
    const out = events.findIndex((e) => e.type === 'ActionStarted' && e.actor === 1);
    expect(events[out + 1]).toEqual({ round: 1, type: 'ActionSkipped', actor: 1, reason: 'leftField' });
    expect(ofType(ok(state, {}).events, 'ActionStarted').map((e) => e.actor)).toContain(4);
  });

  it('exchanges places: the incoming takes the slot, the outgoing takes its bench position', () => {
    const { state } = ok(sturdy(), swap(1, 4));
    expect(state.sides.a.slots[0]?.occupant).toBe(4);
    expect(at(state, 4)).toMatchObject({ slot: 'active', activeSlot: 0, benchOrder: null });
    expect(at(state, 1)).toMatchObject({ slot: 'bench', activeSlot: null, benchOrder: 1 });
    expect([at(state, 3).benchOrder, at(state, 5).benchOrder]).toEqual([0, 2]);
    assertInvariants(state);
  });

  it('switching out cures Overfit, Deprecated and Prompt Injected and drops a charge', () => {
    const s = sturdy();
    at(s, 1).statuses.push(
      { id: 'overfit', remaining: 2, source: 7 },
      { id: 'deprecated', remaining: 3 },
      { id: 'promptInjected', remaining: 1, injected: { moveId: 'ship-it', target: 2 } },
      { id: 'hallucinating', remaining: 3 },
    );
    at(s, 1).charging = { moveId: 'deliberate', target: 7, remaining: 1, powerDelta: 0, hitPower: -30 };
    const { state, events } = ok(s, swap(1, 3));
    expect(ofType(events, 'StatusCured').filter((e) => e.target === 1).map((e) => e.status)).toEqual(['overfit', 'deprecated', 'promptInjected']);
    expect(at(state, 1).statuses.map((x) => x.id)).toEqual(['hallucinating']);
    expect(at(state, 1).charging).toBeNull();
  });

  it('is a no-op when the chosen bench creature has already been brought in this round', () => {
    // a-act1 Tokenibble's Early Exit (+3, Latency 12) brings in a-b1 before the orchestrator's Swap (+3, Latency 10).
    const s = sturdy({ active: [mon('a-act1', 'tokenibble'), mon('a-act2', 'forkling')] });
    at(s, 1).moves = ['early-exit', 'compact', 'clear', 'guardrail'];
    const { state, events } = ok(s, swap(2, 3));
    expect(ofType(events, 'Swapped')).toEqual([{ round: 1, type: 'Swapped', side: 0, outIndex: 1, inIndex: 3 }]);
    expect(state.sides.a.slots.map((x) => x.occupant)).toEqual([3, 2]);
    assertInvariants(state);
  });
});

describe('Early Exit (reorder fieldSlot, Ruling 9)', () => {
  it('swaps the user out for the first living bench creature after it hits', () => {
    const s = fresh();
    at(s, 3).hp = 0;
    at(s, 3).fainted = true;
    const events = run(s, 1, 'early-exit', 7);
    expect(ofType(events, 'Swapped')).toEqual([{ round: 1, type: 'Swapped', side: 0, outIndex: 1, inIndex: 4 }]);
    expect(ofType(events, 'Damage')).toHaveLength(1);
    expect(at(s, 1)).toMatchObject({ slot: 'bench', benchOrder: 1 });
    assertInvariants(s);
  });

  it('stays in on a miss, with no living bench creature, or when the user is an orchestrator', () => {
    const miss = fresh();
    at(miss, 7).stages.evasion = 1; // 100 − 10 = 90: lo(d3) 99 misses
    expect(ofType(run(miss, 1, 'early-exit', 7, { d3lo: 99 }), 'Swapped')).toEqual([]);
    const empty = fresh();
    for (const i of [3, 4, 5]) Object.assign(at(empty, i), { hp: 0, fainted: true });
    expect(ofType(run(empty, 1, 'early-exit', 7), 'Swapped')).toEqual([]);
    const orch = fresh();
    expect(ofType(run(orch, 0, 'early-exit', 7), 'Swapped')).toEqual([]);
    expect(at(orch, 0).slot).toBe('orchestrator');
  });
});

describe('bench recovery', () => {
  it('each living bench creature frees its 2 oldest tokens at end of round', () => {
    const s = sturdy();
    for (let k = 0; k < 5; k++) at(s, 3).context.tokens.push({ kind: 'cost', seq: k });
    at(s, 4).context.tokens.push({ kind: 'junk', seq: 0 });
    const { state, events } = ok(s, {});
    expect(ofType(events, 'ContextAdded').filter((e) => e.target === 3 || e.target === 4)).toEqual([
      { round: 1, type: 'ContextAdded', target: 3, kind: 'recovered', tokens: -2, tokensAfter: 3 },
      { round: 1, type: 'ContextAdded', target: 4, kind: 'recovered', tokens: -1, tokensAfter: 0 },
    ]);
    expect(at(state, 3).context.tokens.map((t) => t.seq)).toEqual([2, 3, 4]);
    const end = events.findIndex((e) => e.type === 'RoundEnd');
    expect(events.findIndex((e) => e.type === 'ContextAdded' && e.target === 3)).toBeLessThan(end);
  });
});
