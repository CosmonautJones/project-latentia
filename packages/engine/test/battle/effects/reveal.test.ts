import { describe, expect, it } from 'vitest';
import { tickFields } from '../../../src/battle/effects/timedField.js';
import type { RoundCommand } from '../../../src/battle/log.js';
import { submitRound } from '../../../src/battle/round.js';
import type { BattleState } from '../../../src/battle/state.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { at } from '../helpers.js';
import { fresh, ofType, run } from './kit.js';

// reveal (spec §6): a timed reveal on the target, kept in BattleState.fields like a timed field effect
// (nextIntent → 'revealIntents', topDeckCard → 'revealTopDeckCard'). Revealed is emitted when it starts and
// again after planning at the start of each later round it lasts.

function ok(s: BattleState, cmd: RoundCommand): { state: BattleState; events: BattleEvent[] } {
  const r = submitRound(s, cmd);
  if ('error' in r) throw new Error(r.error.message);
  return r;
}

describe('reveal', () => {
  it('Socratic Method reveals the target’s next intent for 1 round', () => {
    const s = fresh();
    const events = run(s, 0, 'socratic-method', 7);
    expect(events.filter((e) => e.type === 'FieldEffectStarted' || e.type === 'Revealed')).toEqual([
      { round: 1, type: 'FieldEffectStarted', effect: 'revealIntents', side: 1, target: 7, rounds: 1 },
      { round: 1, type: 'Revealed', actor: 0, target: 7, what: 'nextIntent' },
    ]);
    const end: BattleEvent[] = [];
    tickFields(s, end);
    expect(end).toEqual([{ round: 1, type: 'FieldEffectEnded', effect: 'revealIntents', side: 1, target: 7 }]);
  });

  it('Stack Trace reveals the target’s top deck card in each of 3 rounds', () => {
    const s = fresh();
    s.round = 0;
    at(s, 0).moves = ['stack-trace', 'compact', 'clear', 'guardrail'];
    const idle: RoundCommand = { a: { temperature: 2, action: { kind: 'none' } } };
    const cards = (events: BattleEvent[]) => ofType(events, 'Revealed').filter((e) => e.what === 'topDeckCard').map((e) => [e.actor, e.target]);
    const r1 = ok(s, { a: { temperature: 2, action: { kind: 'move', moveId: 'stack-trace', target: 7 } } });
    expect(cards(r1.events)).toEqual([[0, 7]]);
    const r2 = ok(r1.state, idle);
    expect(cards(r2.events)).toEqual([[0, 7]]);
    const r3 = ok(r2.state, idle);
    expect(cards(r3.events)).toEqual([[0, 7]]);
    expect(ofType(r3.events, 'FieldEffectEnded')).toEqual([{ round: 3, type: 'FieldEffectEnded', effect: 'revealTopDeckCard', side: 1, target: 7 }]);
    expect(cards(ok(r3.state, idle).events)).toEqual([]);
  });

  it('a holder off the field gets no round-start Revealed (it has no intent), but the reveal keeps ticking', () => {
    const s = fresh();
    s.round = 0;
    at(s, 0).moves = ['stack-trace', 'compact', 'clear', 'guardrail'];
    const r1 = ok(s, { a: { temperature: 2, action: { kind: 'move', moveId: 'stack-trace', target: 7 } } });
    const r2 = ok(r1.state, { b: { temperature: 2, action: { kind: 'swap', out: 7, in: 9 } } });
    expect(at(r2.state, 7).slot).toBe('bench');
    const r3 = ok(r2.state, {});
    expect(ofType(r3.events, 'Revealed').filter((e) => e.target === 7)).toEqual([]);
    expect(ofType(r3.events, 'FieldEffectEnded').map((e) => [e.effect, e.target])).toEqual([['revealTopDeckCard', 7]]);
  });
});
