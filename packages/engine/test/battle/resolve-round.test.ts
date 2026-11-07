import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../../src/events/types.js';
import { drawAction, drawRoundStart } from '../../src/rng/draws.js';
import type { SeedHex } from '../../src/rng/seed.js';
import type { RoundCommand } from '../../src/battle/log.js';
import { submitRound } from '../../src/battle/round.js';
import { createBattle } from '../../src/battle/setup.js';
import type { BattleState, Card } from '../../src/battle/state.js';
import { at, battle, gridlessSetup, mon } from './helpers.js';

// The real resolution pipeline under submitRound (round.test.ts mocks resolveAction).
describe('through submitRound (the real pipeline)', () => {
  const seedOf = (i: number): string => `c0ffee${i.toString(16).padStart(26, '0')}`;
  const ok = (s: BattleState, cmd: RoundCommand = {}) => {
    const r = submitRound(s, cmd);
    if ('error' in r) throw new Error(r.error.message);
    return r;
  };

  it('a side whose every creature is Rate Limited and skipped still advances to the next round (Review Focus 2)', () => {
    let found: { state: BattleState; events: BattleEvent[]; before: BattleState } | null = null;
    for (let i = 1; i < 4000 && found === null; i++) {
      const s = createBattle(gridlessSetup({ bench: [] }), seedOf(i) as SeedHex);
      // Rate Limited halves Latency, so side A acts last: sturdy HP keeps side B from KO'ing it first.
      for (const c of s.creatures) if (c.side === 'a') Object.assign(c, { hp: 500, maxHp: 500, statuses: [{ id: 'rateLimited', remaining: 3 }] });
      const r = ok(s);
      const skips = r.events.filter((e) => e.type === 'ActionSkipped' && e.reason === 'rateLimited');
      if (skips.length === 3) found = { ...r, before: s };
    }
    if (found === null) throw new Error('no seed skipped all three');
    const { state, events, before } = found;
    expect(state.round).toBe(1);
    expect(events.filter((e) => e.type === 'MoveUsed' && at(state, e.actor).side === 'a')).toEqual([]);
    expect(events.at(-1)).toEqual({ round: 1, type: 'RoundEnd' });
    // Draw accounting: R1/R2 for all 9 creatures, then exactly six draws per ActionStarted, in order.
    const ref = structuredClone(before.rng);
    for (const c of state.creatures) expect(c.roundStart).toEqual(drawRoundStart(ref));
    const started = events.filter((e) => e.type === 'ActionStarted');
    expect(started).toHaveLength(6);
    for (const e of started) expect(e.draws).toEqual(drawAction(ref));
    expect(state.rng).toEqual(ref);
    expect(ok(state).state.round).toBe(2);
  });

  it('a creature KO’d before its entry emits ActionSkipped { reason: "fainted" } and still consumes its draws', () => {
    const s = battle();
    at(s, 8).hp = 1; // every side-a default intent aims at the lowest-HP foe: b-act2 (Latency 10)
    const { state, events } = ok(s);
    const ko = events.findIndex((e) => e.type === 'Fainted' && e.target === 8);
    const mine = events.findIndex((e) => e.type === 'ActionStarted' && e.actor === 8);
    expect(ko).toBeGreaterThan(-1);
    expect(mine).toBeGreaterThan(ko);
    expect(events[mine + 1]).toEqual({ round: 1, type: 'ActionSkipped', actor: 8, reason: 'fainted' });
    const ref = structuredClone(s.rng);
    state.creatures.forEach(() => drawRoundStart(ref));
    for (const e of events.filter((x) => x.type === 'ActionStarted')) expect(e.draws).toEqual(drawAction(ref));
    expect(state.rng).toEqual(ref);
  });

  it('resets the Handoff chains at round start', () => {
    const s = battle();
    at(s, 7).stats.latency = 1; // a-act1 Blitzr (Latency 13) acts first and aims at the lowest-HP foe, b-act1 (7)
    s.handoff = [{ target: 7, side: 'a', actors: [5, 5] }]; // stale: a bench creature never hits
    const { events } = ok(s);
    expect(events.find((e) => e.type === 'MoveUsed')).toEqual({ round: 1, type: 'MoveUsed', actor: 1, moveId: 'ship-it', target: 7 });
    expect(events.find((e) => e.type === 'HandoffChain')).toEqual({ round: 1, type: 'HandoffChain', actor: 1, chain: [1] });
  });

  it('an enemy lever (Policy Update) between two allied hits breaks the chain; a none command does not', () => {
    const chainsWith = (action: RoundCommand['b']) => {
      // a-act1 Blitzr (Latency 13) hits first, then the lone b-orch's command (10), then a-orch (Latency forced to 1).
      const s = battle({ active: [mon('a-act1', 'blitzr')], bench: [] }, { active: [], bench: [] });
      at(s, 0).stats.latency = 1;
      return ok(s, action === undefined ? {} : { b: action }).events.filter((e) => e.type === 'HandoffChain').map((e) => e.chain);
    };
    expect(chainsWith({ temperature: 2, action: { kind: 'policyUpdate', card: {} as Card } })).toEqual([[1], [0]]);
    expect(chainsWith({ temperature: 2, action: { kind: 'none' } })).toEqual([[1], [1, 0]]);
  });
});
