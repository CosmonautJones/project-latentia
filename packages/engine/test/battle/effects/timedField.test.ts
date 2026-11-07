import { describe, expect, it } from 'vitest';
import { tickFields } from '../../../src/battle/effects/timedField.js';
import type { RoundCommand } from '../../../src/battle/log.js';
import { submitRound } from '../../../src/battle/round.js';
import type { BattleState } from '../../../src/battle/state.js';
import { temperatureOf } from '../../../src/battle/targeting.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { at } from '../helpers.js';
import { fresh, ofType, run } from './kit.js';

// Timed field effects (spec §6 timedField): plain data in BattleState.fields, started with
// FieldEffectStarted, ticked at end of round (the cast round counts) and ended with FieldEffectEnded.

const UNIVERSALS = ['compact', 'clear', 'guardrail'];

function ok(s: BattleState, cmd: RoundCommand): { state: BattleState; events: BattleEvent[] } {
  const r = submitRound(s, cmd);
  if ('error' in r) throw new Error(r.error.message);
  return r;
}

const use = (moveId: string, target: number): RoundCommand => ({ a: { temperature: 2, action: { kind: 'move', moveId, target } } });
const idle: RoundCommand = { a: { temperature: 2, action: { kind: 'none' } } };

/** Side A's orchestrator (index 0) knows only `moveId` plus the universals. */
function withMove(moveId: string): BattleState {
  const s = fresh();
  s.round = 0;
  at(s, 0).moves = [moveId, ...UNIVERSALS];
  return s;
}

const junkOn = (events: BattleEvent[], target: number) => ofType(events, 'ContextAdded').filter((e) => e.target === target && e.kind === 'junk');

describe('Memory Leak (junkPerRound, 3 rounds)', () => {
  it('starts a field on the target, adds 1 Junk at the end of each of 3 rounds, then FieldEffectEnded', () => {
    const r1 = ok(withMove('memory-leak'), use('memory-leak', 7));
    expect(ofType(r1.events, 'FieldEffectStarted')).toEqual([{ round: 1, type: 'FieldEffectStarted', effect: 'junkPerRound', side: 1, target: 7, rounds: 3 }]);
    expect(r1.state.fields).toEqual([{ effect: { kind: 'junkPerRound', count: 1 }, source: 0, target: 7, remaining: 2 }]);
    // The Junk lands at end of round: after every action of the round.
    const lastAction = r1.events.map((e) => e.type).lastIndexOf('ActionStarted');
    expect(r1.events.indexOf(junkOn(r1.events, 7)[0] as BattleEvent)).toBeGreaterThan(lastAction);
    expect(junkOn(r1.events, 7).map((e) => e.tokens)).toEqual([1]);
    expect(ofType(r1.events, 'FieldEffectEnded')).toEqual([]);

    const r2 = ok(r1.state, idle);
    expect(junkOn(r2.events, 7)).toHaveLength(1);
    expect(ofType(r2.events, 'FieldEffectEnded')).toEqual([]);

    const r3 = ok(r2.state, idle);
    expect(junkOn(r3.events, 7)).toHaveLength(1);
    expect(ofType(r3.events, 'FieldEffectEnded')).toEqual([{ round: 3, type: 'FieldEffectEnded', effect: 'junkPerRound', side: 1, target: 7 }]);
    expect(r3.state.fields).toEqual([]);

    const r4 = ok(r3.state, idle);
    expect(junkOn(r4.events, 7)).toEqual([]);
    expect(at(r4.state, 7).context.tokens.filter((t) => t.kind === 'junk')).toHaveLength(3);
  });

  it('ends when its holder leaves the field (FieldEffectEnded with the leaving cures, before Swapped); no more Junk (Ruling 63)', () => {
    const r1 = ok(withMove('memory-leak'), use('memory-leak', 7));
    const r2 = ok(r1.state, { ...idle, b: { temperature: 2, action: { kind: 'swap', out: 7, in: 9 } } });
    const swapped = r2.events.findIndex((e) => e.type === 'Swapped' && e.outIndex === 7);
    expect(r2.events[swapped - 1]).toEqual({ round: 2, type: 'FieldEffectEnded', effect: 'junkPerRound', side: 1, target: 7 });
    expect(junkOn(r2.events, 7)).toEqual([]);
    expect(r2.state.fields).toEqual([]);
  });

  it('a field on a KO’d holder ends at the next tick without effect', () => {
    const s = fresh();
    run(s, 1, 'memory-leak', 7);
    at(s, 7).hp = 0;
    at(s, 7).fainted = true;
    const events: BattleEvent[] = [];
    tickFields(s, events);
    expect(events).toEqual([{ round: 1, type: 'FieldEffectEnded', effect: 'junkPerRound', side: 1, target: 7 }]);
    expect(s.fields).toEqual([]);
  });

  it('re-applying the same field to the same holder refreshes it instead of stacking', () => {
    const s = fresh();
    run(s, 1, 'memory-leak', 7);
    tickFields(s, []);
    s.round = 2;
    run(s, 2, 'memory-leak', 7);
    expect(s.fields).toEqual([{ effect: { kind: 'junkPerRound', count: 1 }, source: 2, target: 7, remaining: 3 }]);
  });
});

describe('Saliency Map (revealIntents on foes, accuracyStages on allies, 3 rounds)', () => {
  const revealed = (events: BattleEvent[]) => ofType(events, 'Revealed').map((e) => [e.actor, e.target, e.what]);

  it('emits Revealed for every on-field foe in each of 3 rounds, then both fields end', () => {
    const r1 = ok(withMove('saliency-map'), use('saliency-map', 0));
    expect(ofType(r1.events, 'FieldEffectStarted').map((e) => [e.effect, e.target, e.rounds])).toEqual([
      ['revealIntents', 6, 3], ['revealIntents', 7, 3], ['revealIntents', 8, 3],
      ['accuracyStages', 0, 3], ['accuracyStages', 1, 3], ['accuracyStages', 2, 3],
    ]);
    const foes = [[0, 6, 'nextIntent'], [0, 7, 'nextIntent'], [0, 8, 'nextIntent']];
    expect(revealed(r1.events)).toEqual(foes);
    const r2 = ok(r1.state, idle);
    expect(revealed(r2.events)).toEqual(foes);
    // Round-start reveals come right after the round's planning, before any action.
    expect(r2.events.findIndex((e) => e.type === 'Revealed')).toBeLessThan(r2.events.findIndex((e) => e.type === 'ActionStarted'));
    const r3 = ok(r2.state, idle);
    expect(revealed(r3.events)).toEqual(foes);
    expect(ofType(r3.events, 'FieldEffectEnded').map((e) => [e.effect, e.target])).toEqual([
      ['revealIntents', 6], ['revealIntents', 7], ['revealIntents', 8],
      ['accuracyStages', 0], ['accuracyStages', 1], ['accuracyStages', 2],
    ]);
    expect(revealed(ok(r3.state, idle).events)).toEqual([]);
  });

  it('allies are +1 accuracy stage while it lasts (no StageChanged: it is a field, not a stage)', () => {
    // Adversarial Patch: accuracy 90 at T2; lo(D3) = 90 misses at +0 and hits at +1 (100).
    const control = fresh();
    expect(ofType(run(control, 1, 'adversarial-patch', 7, { d3lo: 90 }), 'Missed')).toHaveLength(1);
    const s = fresh();
    const cast = run(s, 0, 'saliency-map', 0);
    expect(ofType(cast, 'StageChanged')).toEqual([]);
    expect(ofType(run(s, 1, 'adversarial-patch', 7, { d3lo: 90 }), 'Missed')).toEqual([]);
    // Foes do not get it.
    expect(ofType(run(s, 7, 'adversarial-patch', 1, { d3lo: 90 }), 'Missed')).toHaveLength(1);
  });
});

describe('Temperature Spike (forceTemperature T4, 2 rounds)', () => {
  it('forces the target to T4 for the cast round and the next, then ends', () => {
    const s = fresh();
    run(s, 0, 'temperature-spike', 7);
    expect(temperatureOf(s, at(s, 7))).toBe(4);
    expect(temperatureOf(s, at(s, 8))).toBe(2);
    const e1: BattleEvent[] = [];
    tickFields(s, e1);
    expect(e1).toEqual([]);
    s.round = 2;
    expect(temperatureOf(s, at(s, 7))).toBe(4);
    const e2: BattleEvent[] = [];
    tickFields(s, e2);
    expect(e2).toEqual([{ round: 2, type: 'FieldEffectEnded', effect: 'forceTemperature', side: 1, target: 7 }]);
    expect(temperatureOf(s, at(s, 7))).toBe(2);
  });

  it('a forced orchestrator acts at T4 whatever its side commands (T4 self-hallucination 12%)', () => {
    const s = fresh();
    run(s, 1, 'temperature-spike', 6);
    expect(s.sides.b.temperature).toBe(2);
    expect(temperatureOf(s, at(s, 6))).toBe(4);
    // hi(D2, 100) = 5 < 12 at T4 (0 at T2): the move is replaced by moves[hi(D4, n)] = moves[0].
    const events = run(s, 6, 'compact', 6, { d2hi: 5 });
    expect(ofType(events, 'MoveUsed')[0]?.moveId).toBe(at(s, 6).moves[0]);
  });
});

describe('Red Team (reveal 2 rounds + critStagesAgainst +1 for 3 rounds)', () => {
  it('the user’s side gets +1 crit stage against the holder', () => {
    // T2 base crit stage 2 → threshold 2; +1 → stage 3 → threshold 4. lo(D4, 48) = 3 crits only with Red Team.
    const control = fresh();
    expect(ofType(run(control, 1, 'ship-it', 7, { d4lo: 3 }), 'Crit')).toEqual([]);
    const s = fresh();
    const cast = run(s, 0, 'red-team', 7);
    expect(ofType(cast, 'Revealed')).toEqual([{ round: 1, type: 'Revealed', actor: 0, target: 7, what: 'nextIntent' }]);
    expect(ofType(cast, 'FieldEffectStarted').map((e) => [e.effect, e.target, e.rounds])).toEqual([['revealIntents', 7, 2], ['critStagesAgainst', 7, 3]]);
    expect(ofType(run(s, 1, 'ship-it', 7, { d4lo: 3 }), 'Crit')).toHaveLength(1);
    // The holder's own side does not.
    expect(ofType(run(s, 8, 'ship-it', 7, { d4lo: 3 }), 'Crit')).toEqual([]);
  });
});
