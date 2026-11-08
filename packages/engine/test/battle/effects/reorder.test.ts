import { describe, expect, it } from 'vitest';
import type { RoundCommand } from '../../../src/battle/log.js';
import { submitRound } from '../../../src/battle/round.js';
import type { BattleState } from '../../../src/battle/state.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { at } from '../helpers.js';
import { fresh, ofType } from './kit.js';

// Rerank (reorder turnOrder): this round's not-yet-resolved entries live in BattleState.turnOrder. The user
// gives its turn to the target: the target's pending entry moves to resolve right after the user's action.
// Every entry still resolves exactly once (six draws each); a target that already acted is unaffected.

function ok(s: BattleState, cmd: RoundCommand): { state: BattleState; events: BattleEvent[] } {
  const r = submitRound(s, cmd);
  if ('error' in r) throw new Error(r.error.message);
  return r;
}

const order = (events: BattleEvent[]) => ofType(events, 'ActionStarted').map((e) => e.actor);

function rerankBattle(): BattleState {
  const s = fresh();
  s.round = 0;
  at(s, 0).moves = ['rerank', 'compact', 'clear', 'guardrail'];
  return s;
}

describe('Rerank (reorder turnOrder)', () => {
  it('moves the target’s pending entry to right after the user, once; every entry resolves exactly once', () => {
    const s = rerankBattle();
    // Baseline: the other five entries' sorted order does not depend on the orchestrator's command.
    const baseline = order(ok(s, { a: { temperature: 2, action: { kind: 'none' } } }).events).filter((a) => a !== 0);
    const last = baseline.at(-1) as number;
    const { state, events } = ok(s, { a: { temperature: 2, action: { kind: 'move', moveId: 'rerank', target: last } } });
    // Rerank is +2: the orchestrator acts first, then the target, then the rest in their sorted order.
    expect(order(events)).toEqual([0, last, ...baseline.filter((a) => a !== last)]);
    expect(state.turnOrder).toEqual([]);
  });

  it('a target that already acted this round is unaffected', () => {
    const s = rerankBattle();
    // b-act1 raises a +4 Captcha Wall, so it resolves before the +2 Rerank.
    at(s, 7).moves = ['captcha-wall', 'compact', 'clear', 'guardrail'];
    const baseline = order(ok(s, { a: { temperature: 2, action: { kind: 'none' } } }).events).filter((a) => a !== 0);
    expect(baseline[0]).toBe(7);
    const events = ok(s, { a: { temperature: 2, action: { kind: 'move', moveId: 'rerank', target: 7 } } }).events;
    expect(order(events)).toEqual([7, 0, ...baseline.slice(1)]);
  });
});
