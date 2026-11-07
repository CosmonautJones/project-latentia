import { describe, expect, it } from 'vitest';
import { planEntries } from '../../../src/battle/order.js';
import { submitRound } from '../../../src/battle/round.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { at } from '../helpers.js';
import { fresh, ofType, run } from './kit.js';

// Next-action modifiers (spec §6 nextActionModifier), each consumed at one point of the holder's next action:
// priority at Sort; costSet / costAdd when it pays; fail / cannotMiss / ignoreEvasion / accuracy at its
// accuracy step (a charge round has none); powerBp, incomingDamageBp and skip as in A12b.

const costPaid = (events: BattleEvent[], actor: number) =>
  ofType(events, 'ContextAdded').filter((e) => e.target === actor && e.kind === 'cost').reduce((n, e) => n + e.tokens, 0);

describe('Embedding Cache (costSet 0)', () => {
  it('makes the holder’s next move cost 0, once', () => {
    const s = fresh();
    expect(costPaid(run(s, 1, 'embedding-cache', 1), 1)).toBe(1);
    expect(at(s, 1).nextActionMods).toEqual([{ kind: 'costSet', cells: 0 }]);
    const free = run(s, 1, 'segfault', 7);
    expect(ofType(free, 'MoveUsed')).toHaveLength(1);
    expect(costPaid(free, 1)).toBe(0);
    expect(at(s, 1).nextActionMods).toEqual([]);
    expect(costPaid(run(s, 1, 'segfault', 7), 1)).toBe(3);
  });
});

describe('Token Nibble (costAdd +1 on the target)', () => {
  it('the target’s next move costs one more cell, once', () => {
    const s = fresh();
    run(s, 1, 'token-nibble', 7);
    expect(at(s, 7).nextActionMods).toEqual([{ kind: 'costAdd', cells: 1 }]);
    expect(costPaid(run(s, 7, 'ship-it', 1), 7)).toBe(2);
    expect(costPaid(run(s, 7, 'ship-it', 1), 7)).toBe(1);
  });

  it('costSet applies before costAdd, and Quantized’s −1 after both (floored at 0)', () => {
    const s = fresh();
    at(s, 7).nextActionMods = [{ kind: 'costAdd', cells: 1 }, { kind: 'costSet', cells: 0 }];
    at(s, 7).statuses.push({ id: 'quantized', remaining: 3 });
    expect(costPaid(run(s, 7, 'segfault', 1), 7)).toBe(0);
  });
});

describe('Bounding Box (cannotMiss)', () => {
  it('the holder’s next move cannot miss, once', () => {
    const s = fresh();
    run(s, 1, 'bounding-box', 1);
    const sure = run(s, 1, 'segfault', 7, { d3lo: 99 });
    expect(ofType(sure, 'Missed')).toEqual([]);
    expect(ofType(sure, 'Damage')).toHaveLength(1);
    expect(ofType(run(s, 1, 'segfault', 7, { d3lo: 99 }), 'Missed')).toHaveLength(1);
  });

  it('a charge round does not use it up; the release cannot miss', () => {
    const s = fresh();
    at(s, 1).nextActionMods = [{ kind: 'cannotMiss' }];
    run(s, 1, 'deliberate', 7);
    expect(at(s, 1).nextActionMods).toEqual([{ kind: 'cannotMiss' }]);
    s.round = 2;
    const release = run(s, 1, 'deliberate', 7, { d3lo: 99 });
    expect(ofType(release, 'Damage')).toHaveLength(1);
    expect(ofType(release, 'Missed')).toEqual([]);
    expect(at(s, 1).nextActionMods).toEqual([]);
  });
});

describe('Segfault (20% fail rider, lo(D6, 100) < 20)', () => {
  it('lo(D6) = 19 queues `fail` on the target; its next move is used, pays, and fails like a miss', () => {
    const s = fresh();
    run(s, 1, 'segfault', 7, { d6lo: 19 });
    expect(at(s, 7).nextActionMods).toEqual([{ kind: 'fail' }]);
    const failed = run(s, 7, 'ship-it', 1);
    expect(failed.filter((e) => e.type !== 'ContextAdded' && e.type !== 'ObservationGained')).toEqual([
      { round: 1, type: 'MoveUsed', actor: 7, moveId: 'ship-it', target: 1 },
      { round: 1, type: 'Missed', actor: 7, target: 1 },
    ]);
    expect(costPaid(failed, 7)).toBe(1);
    expect(at(s, 7).nextActionMods).toEqual([]);
    expect(ofType(run(s, 7, 'ship-it', 1), 'Damage')).toHaveLength(1);
  });

  it('lo(D6) = 20 does not', () => {
    const s = fresh();
    run(s, 1, 'segfault', 7, { d6lo: 20 });
    expect(at(s, 7).nextActionMods).toEqual([]);
  });

  it('no rider when Segfault misses', () => {
    const s = fresh();
    run(s, 1, 'segfault', 7, { d3lo: 99, d6lo: 0 });
    expect(at(s, 7).nextActionMods).toEqual([]);
  });
});

describe('Socratic Method (accuracy −15) and Ground Truth (ignoreEvasion)', () => {
  it('Socratic Method: the target’s next move has −15 accuracy, once', () => {
    // Ship It accuracy 95 at T2: lo(D3) = 85 hits normally, misses at 80.
    const s = fresh();
    run(s, 0, 'socratic-method', 7);
    expect(at(s, 7).nextActionMods).toEqual([{ kind: 'accuracy', delta: -15 }]);
    expect(ofType(run(s, 7, 'ship-it', 1, { d3lo: 85 }), 'Missed')).toHaveLength(1);
    expect(ofType(run(s, 7, 'ship-it', 1, { d3lo: 85 }), 'Missed')).toEqual([]);
  });

  it('Ground Truth: every ally’s next move ignores the target’s positive evasion', () => {
    // +1 evasion: Ship It 95 − 10 = 85, so lo(D3) = 90 misses; ignoring evasion it is 95 and hits.
    const control = fresh();
    at(control, 7).stages.evasion = 1;
    expect(ofType(run(control, 1, 'ship-it', 7, { d3lo: 90 }), 'Missed')).toHaveLength(1);
    const s = fresh();
    at(s, 7).stages.evasion = 1;
    run(s, 0, 'ground-truth', 0);
    for (const i of [0, 1, 2]) expect(at(s, i).nextActionMods).toEqual([{ kind: 'ignoreEvasion' }]);
    expect(ofType(run(s, 1, 'ship-it', 7, { d3lo: 90 }), 'Missed')).toEqual([]);
    expect(ofType(run(s, 1, 'ship-it', 7, { d3lo: 90 }), 'Missed')).toHaveLength(1);
  });
});

describe('priority (Blitzr’s Move Fast)', () => {
  it('adds to the holder’s entry priority at Sort and is used up by that Sort', () => {
    const s = fresh();
    at(s, 2).nextActionMods = [{ kind: 'priority', delta: 1 }];
    expect(planEntries(s, {}).find((e) => e.actor === 2)?.priority).toBe(1);
    s.round = 0;
    const r = submitRound(s, {});
    if ('error' in r) throw new Error(r.error.message);
    expect(at(r.state, 2).nextActionMods).toEqual([]);
    expect(planEntries(r.state, {}).find((e) => e.actor === 2)?.priority).toBe(0);
  });
});
