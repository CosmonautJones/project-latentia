import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../../src/events/types.js';
import { drawAction, drawRoundStart } from '../../src/rng/draws.js';
import type { RoundCommand } from '../../src/battle/log.js';
import { submitRound } from '../../src/battle/round.js';
import type { BattleState } from '../../src/battle/state.js';
import { at, battle, faint } from './helpers.js';

function ok(state: BattleState, cmd: RoundCommand): { state: BattleState; events: BattleEvent[] } {
  const r = submitRound(state, cmd);
  if ('error' in r) throw new Error(`unexpected error ${r.error.code}: ${r.error.message}`);
  return r;
}

function errorCode(state: BattleState, cmd: RoundCommand): string {
  const r = submitRound(state, cmd);
  if (!('error' in r)) throw new Error('expected an error');
  return r.error.code;
}

const started = (events: BattleEvent[]) => events.filter((e) => e.type === 'ActionStarted');

describe('submitRound: round start', () => {
  it('increments the round and opens with RoundStart', () => {
    const r = ok(battle(), {});
    expect(r.state.round).toBe(1);
    expect(r.events[0]).toEqual({ round: 1, type: 'RoundStart' });
    expect(ok(r.state, {}).state.round).toBe(2);
  });

  it('takes R1/R2 for every creature in canonical order, KO\'d and benched ones included, then 6 draws per entry', () => {
    const s = battle();
    faint(at(s, 2)); // KO'd active subagent: R1/R2 but no entry
    faint(at(s, 10)); // KO'd bench creature: R1/R2 only
    faint(at(s, 6)); // KO'd orchestrator: R1/R2 and an entry
    const ref = structuredClone(s.rng);
    const { state, events } = ok(s, {});

    for (const c of state.creatures) expect(c.roundStart).toEqual(drawRoundStart(ref));
    const actions = started(events);
    expect(actions.map((e) => e.actor).sort((x, y) => x - y)).toEqual([0, 1, 6, 7, 8]);
    for (const e of actions) expect(e.draws).toEqual(drawAction(ref));
    // Nothing else drew: 12 creatures x 2 + 5 entries x 6 = 54 nextU32 calls in total.
    expect(state.rng).toEqual(ref);
  });

  it('draws for every creature again in the next round', () => {
    const s = battle();
    faint(at(s, 11));
    const first = ok(s, {});
    const ref = structuredClone(first.state.rng);
    const second = ok(first.state, {});
    for (const c of second.state.creatures) expect(c.roundStart).toEqual(drawRoundStart(ref));
    for (const e of started(second.events)) expect(e.draws).toEqual(drawAction(ref));
    expect(second.state.rng).toEqual(ref);
  });
});

describe('submitRound: resolution', () => {
  it('resolves entries in sorted order: priority, then effective latency', () => {
    const s = battle();
    // a-orch Guardrail at +4 goes first; then latency: blitzr 13 (1, 7), forkling/sagelet 10 (2, 6, 8).
    const { events } = ok(s, { a: { temperature: 2, action: { kind: 'move', moveId: 'guardrail', target: 0 } } });
    const order = started(events).map((e) => e.actor);
    expect(order[0]).toBe(0);
    expect(new Set(order.slice(1, 3))).toEqual(new Set([1, 7]));
    expect(new Set(order.slice(3))).toEqual(new Set([2, 6, 8]));
  });

  it('skips a KO\'d orchestrator as headless after its ActionStarted', () => {
    const s = battle();
    faint(at(s, 0));
    const { events } = ok(s, {});
    const i = events.findIndex((e) => e.type === 'ActionStarted' && e.actor === 0);
    expect(events[i + 1]).toEqual({ round: 1, type: 'ActionSkipped', actor: 0, reason: 'headless' });
  });

  it("emits nothing after ActionStarted for a 'none' command, but still consumes its draws", () => {
    const s = battle();
    const { state, events } = ok(s, { a: { temperature: 2, action: { kind: 'none' } } });
    expect(events.some((e) => e.type === 'ActionStarted' && e.actor === 0)).toBe(true);
    expect(events.filter((e) => e.type === 'ActionSkipped')).toEqual([]);
    // 12 creatures x 2 round-start draws + 6 entries (the 'none' one included) x 6 action draws.
    const exact = structuredClone(s.rng);
    for (let k = 0; k < 12; k++) drawRoundStart(exact);
    for (let k = 0; k < 6; k++) drawAction(exact);
    expect(state.rng).toEqual(exact);
  });

  it('stores the command temperature on its side', () => {
    const { state } = ok(battle(), {
      a: { temperature: 4, action: { kind: 'none' } },
      b: { temperature: 0, action: { kind: 'none' } },
    });
    expect(state.sides.a.temperature).toBe(4);
    expect(state.sides.b.temperature).toBe(0);
  });

  it('closes with RoundEnd and leaves the input state untouched', () => {
    const s = battle();
    const before = structuredClone(s);
    const { state, events } = ok(s, {});
    expect(events.at(-1)).toEqual({ round: 1, type: 'RoundEnd' });
    expect(s).toEqual(before);
    expect(state).not.toBe(s);
  });
});

describe('submitRound: end of round', () => {
  it('auto-fills an empty slot from the bench before RoundEnd', () => {
    const s = battle();
    faint(at(s, 1));
    const { state, events } = ok(s, {});
    const swap = events.findIndex((e) => e.type === 'Swapped');
    expect(events[swap]).toEqual({ round: 1, type: 'Swapped', side: 0, outIndex: 1, inIndex: 3 });
    expect(swap).toBeLessThan(events.findIndex((e) => e.type === 'RoundEnd'));
    expect(state.sides.a.slots[0]?.occupant).toBe(3);
  });

  it('ends a battle whose side is wiped with exactly one BattleEnd', () => {
    const s = battle();
    s.creatures.filter((c) => c.side === 'b').forEach(faint);
    const { state, events } = ok(s, {});
    expect(events.filter((e) => e.type === 'BattleEnd')).toEqual([{ round: 1, type: 'BattleEnd', winner: 0, reason: 'knockout' }]);
    expect(state.ended).toBe(true);
    expect(state.result).toBe('a');
  });

  it('applies the HP-ratio cap after round 50 with exactly one BattleEnd', () => {
    const s = battle();
    s.round = 49;
    at(s, 9).hp = 1;
    const { state, events } = ok(s, {});
    expect(state.round).toBe(50);
    expect(events.filter((e) => e.type === 'BattleEnd')).toEqual([{ round: 50, type: 'BattleEnd', winner: 0, reason: 'cap' }]);
    expect(events.at(-1)?.type).toBe('BattleEnd');
    expect(state.ended).toBe(true);
    expect(state.result).toBe('a');
  });

  it('does not apply the cap before round 50', () => {
    const s = battle();
    s.round = 48;
    at(s, 9).hp = 1;
    const { state, events } = ok(s, {});
    expect(events.filter((e) => e.type === 'BattleEnd')).toEqual([]);
    expect(state.ended).toBe(false);
  });
});

describe('submitRound: command errors leave the input untouched', () => {
  const rejects = (s: BattleState, cmd: RoundCommand, code: string) => {
    const before = structuredClone(s);
    expect(errorCode(s, cmd)).toBe(code);
    expect(s).toEqual(before);
  };

  it('unknownMove: a move the orchestrator does not know', () => {
    rejects(battle(), { a: { temperature: 2, action: { kind: 'move', moveId: 'ship-it', target: 7 } } }, 'unknownMove');
    rejects(battle(), { b: { temperature: 2, action: { kind: 'move', moveId: 'no-such-move', target: 1 } } }, 'unknownMove');
  });

  it('notOrchestratorMove: Directive or Policy Update used as a move', () => {
    rejects(battle(), { a: { temperature: 2, action: { kind: 'move', moveId: 'directive', target: 7 } } }, 'notOrchestratorMove');
    rejects(battle(), { a: { temperature: 2, action: { kind: 'move', moveId: 'policy-update', target: 7 } } }, 'notOrchestratorMove');
  });

  it('illegalTarget: not a canonical index of a living creature', () => {
    const s = battle();
    faint(at(s, 7));
    rejects(s, { a: { temperature: 2, action: { kind: 'move', moveId: 'chain-of-thought', target: 7 } } }, 'illegalTarget');
    rejects(battle(), { a: { temperature: 2, action: { kind: 'move', moveId: 'chain-of-thought', target: 12 } } }, 'illegalTarget');
    rejects(battle(), { a: { temperature: 2, action: { kind: 'move', moveId: 'chain-of-thought', target: -1 } } }, 'illegalTarget');
    rejects(battle(), { a: { temperature: 2, action: { kind: 'move', moveId: 'chain-of-thought', target: 1.5 } } }, 'illegalTarget');
  });

  it('directiveOnFainted: a Directive aimed at a KO\'d subagent', () => {
    const s = battle();
    const sub = at(s, 1);
    sub.hp = 0;
    sub.fainted = true;
    rejects(s, { a: { temperature: 2, action: { kind: 'directive', subagent: 1, moveId: 'ship-it', target: 7 } } }, 'directiveOnFainted');
  });

  it('directiveOnFainted: a Directive aimed at a benched creature', () => {
    rejects(battle(), { a: { temperature: 2, action: { kind: 'directive', subagent: 3, moveId: 'token-nibble', target: 7 } } }, 'directiveOnFainted');
  });

  it('validates the Directive move and target against the subagent', () => {
    rejects(battle(), { a: { temperature: 2, action: { kind: 'directive', subagent: 1, moveId: 'hard-fork', target: 7 } } }, 'unknownMove');
    rejects(battle(), { a: { temperature: 2, action: { kind: 'directive', subagent: 1, moveId: 'ship-it', target: 40 } } }, 'illegalTarget');
    rejects(battle(), { a: { temperature: 2, action: { kind: 'directive', subagent: 7, moveId: 'ship-it', target: 1 } } }, 'illegalTarget');
  });

  it('validates Swap: out must be an allied active creature, in a living allied bench creature', () => {
    rejects(battle(), { a: { temperature: 2, action: { kind: 'swap', out: 3, in: 4 } } }, 'illegalTarget');
    rejects(battle(), { a: { temperature: 2, action: { kind: 'swap', out: 1, in: 9 } } }, 'illegalTarget');
    const s = battle();
    faint(at(s, 4));
    rejects(s, { a: { temperature: 2, action: { kind: 'swap', out: 1, in: 4 } } }, 'illegalTarget');
  });

  it('battleEnded: no rounds after the battle ends', () => {
    const s = battle();
    s.ended = true;
    s.result = 'a';
    rejects(s, {}, 'battleEnded');
  });

  it('accepts a legal Directive, Policy Update and Swap (execution arrives in B3 and A12b)', () => {
    ok(battle(), { a: { temperature: 2, action: { kind: 'directive', subagent: 1, moveId: 'ship-it', target: 7 } } });
    ok(battle(), { a: { temperature: 2, action: { kind: 'swap', out: 1, in: 4 } } });
  });
});
