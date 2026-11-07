import { describe, expect, it } from 'vitest';
import { assertInvariants } from '../../../src/battle/invariants.js';
import type { RoundCommand } from '../../../src/battle/log.js';
import { resolveEntry, submitRound } from '../../../src/battle/round.js';
import { createBattle } from '../../../src/battle/setup.js';
import type { BattleState } from '../../../src/battle/state.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { grid, piece } from '../../grid/helpers.js';
import { at, battle, entry, gridlessSide, mon, SEED, withoutPassives } from '../helpers.js';
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

describe('a creature that left the field this round never acts this round (Ruling 52)', () => {
  const UNIVERSALS = ['compact', 'clear', 'guardrail'];

  it('Swap sends a-act1 out, then an ally’s Early Exit brings it back: its entry is still skipped (leftField)', () => {
    const s = sturdy({ active: [mon('a-act1', 'blitzr'), mon('a-act2', 'tokenibble')] });
    at(s, 2).moves = ['early-exit', ...UNIVERSALS];
    at(s, 3).moves = ['token-burst', ...UNIVERSALS]; // a-b1 Tokenibble's signature needs A13's costAdd
    at(s, 0).stats.latency = 50; // the orchestrator's Swap (+3) resolves before a-act2's Early Exit (+3)
    const { state, events } = ok(s, swap(1, 3));
    expect(ofType(events, 'Swapped')).toEqual([
      { round: 1, type: 'Swapped', side: 0, outIndex: 1, inIndex: 3 },
      { round: 1, type: 'Swapped', side: 0, outIndex: 2, inIndex: 1 },
    ]);
    const mine = events.findIndex((e) => e.type === 'ActionStarted' && e.actor === 1);
    expect(mine).toBeGreaterThan(-1); // it still consumes its draws
    expect(events[mine + 1]).toEqual({ round: 1, type: 'ActionSkipped', actor: 1, reason: 'leftField' });
    expect(ofType(events, 'MoveUsed').filter((e) => e.actor === 1)).toEqual([]);
    expect(state.sides.a.slots[1]?.occupant).toBe(1);
    expect(ofType(ok(state, {}).events, 'MoveUsed').filter((e) => e.actor === 1)).toHaveLength(1); // it acts next round
  });

  it('a compacted Slot force-benches a-act1, then an ally’s Early Exit brings it back: still skipped', () => {
    const slot = (id: string, x: number, sub: string) => ({ ...piece(id, 'subagentSlot', x, 1), subagentId: sub });
    const g = grid(5, 4, [piece('sp', 'systemPrompt', 0, 0), slot('slot1', 0, 'a-act1'), slot('slot2', 2, 'a-act2'), piece('tl', 'tool', 4, 1)]);
    const a = gridlessSide('a', { orchestrator: { ...mon('a-orch', 'sagelet'), moves: [] }, active: [mon('a-act1', 'blitzr'), mon('a-act2', 'tokenibble')], bench: [], grid: g });
    const s = withoutPassives(createBattle({ a, b: gridlessSide('b'), kind: 'trainer' }, SEED));
    s.round = 1;
    for (const c of s.creatures) c.hp = c.maxHp = 500;
    for (let k = 0; k < at(s, 0).context.window; k++) at(s, 0).context.tokens.push({ kind: 'cost', seq: k });
    const events: BattleEvent[] = [];
    // Indices: 0 a-orch, 1 a-act1, 2 a-act2, 3 b-orch, 4 b-act1, 5 b-act2.
    resolveEntry(s, entry(4, 'filibuster', 0), events); // forces Junk: slot1 compacts, a-act1 is force-benched
    resolveEntry(s, entry(2, 'early-exit', 4), events); // a-act2 swaps out for the first living bench creature: a-act1
    expect(ofType(events, 'Swapped')).toEqual([
      { round: 1, type: 'Swapped', side: 0, outIndex: 1, inIndex: -1 },
      { round: 1, type: 'Swapped', side: 0, outIndex: 2, inIndex: 1 },
    ]);
    const tail: BattleEvent[] = [];
    resolveEntry(s, entry(1, 'ship-it', 4), tail);
    expect(tail.map((e) => e.type)).toEqual(['ActionStarted', 'ActionSkipped']);
    expect(tail[1]).toEqual({ round: 1, type: 'ActionSkipped', actor: 1, reason: 'leftField' });
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
