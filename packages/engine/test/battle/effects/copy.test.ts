import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../../../src/events/types.js';
import { at } from '../helpers.js';
import { fresh, ofType, run } from './kit.js';

// copy (spec §6, Ruling 58). Buffs: Fork copies the target's highest positive stage (ties in the order
// compute, robustness, latency, accuracy, evasion); Merge Conflict swaps one positive stage picked by
// hi(D6, count). Moves: Episodic Replay re-uses the last allied move, Stochastic Repeat the target's last
// move, with its original target if still legal (else the move's default selector) and this action's draws.

const stages = (events: BattleEvent[]) => ofType(events, 'StageChanged').map((e) => [e.target, e.stat, e.delta, e.stageAfter]);

describe('Fork (copy best buff)', () => {
  it('copies the target’s highest positive stage, ties in StageStat order', () => {
    const s = fresh();
    Object.assign(at(s, 7).stages, { compute: 1, latency: 2, evasion: 2 });
    expect(stages(run(s, 1, 'fork', 7))).toEqual([[1, 'latency', 2, 2]]);
    expect(at(s, 7).stages.latency).toBe(2);
  });

  it('never lowers the user’s own stage, and does nothing without a positive stage', () => {
    const s = fresh();
    at(s, 7).stages.compute = 2;
    at(s, 1).stages.compute = 3;
    expect(stages(run(s, 1, 'fork', 7))).toEqual([]);
    at(s, 7).stages.compute = -1;
    expect(stages(run(s, 1, 'fork', 7))).toEqual([]);
  });
});

describe('Merge Conflict (swap one random positive stage)', () => {
  it('hi(D6, count) picks among the target’s positive stages in StageStat order; the two exchange it', () => {
    const s = fresh();
    Object.assign(at(s, 7).stages, { compute: 1, robustness: 2 });
    at(s, 1).stages.robustness = -1;
    const events = run(s, 1, 'merge-conflict', 7, { d6hi: 1 });
    expect(ofType(events, 'Damage')).toHaveLength(1);
    expect(stages(events)).toEqual([[1, 'robustness', 3, 2], [7, 'robustness', -3, -1]]);
  });

  it('nothing to swap when the target has no positive stage', () => {
    const s = fresh();
    at(s, 1).stages.compute = 2;
    expect(stages(run(s, 1, 'merge-conflict', 7))).toEqual([]);
  });
});

describe('Episodic Replay (copy the last allied move)', () => {
  it('re-uses the side’s last move at its original target, paying the copied cost − 1', () => {
    const s = fresh();
    run(s, 2, 'segfault', 7);
    expect(s.sides.a.lastMove).toEqual({ actor: 2, moveId: 'segfault', target: 7 });
    const events = run(s, 0, 'episodic-replay', 0);
    expect(ofType(events, 'MoveUsed')).toEqual([
      { round: 1, type: 'MoveUsed', actor: 0, moveId: 'episodic-replay', target: 0 },
      { round: 1, type: 'MoveUsed', actor: 0, moveId: 'segfault', target: 7 },
    ]);
    expect(ofType(events, 'Damage').map((e) => [e.actor, e.target])).toEqual([[0, 7]]);
    expect(ofType(events, 'ContextAdded').filter((e) => e.target === 0 && e.kind === 'cost').map((e) => e.tokens)).toEqual([2]);
    // The copier's history keeps the move it used; the side's last move is the copied one, by the copier.
    expect(at(s, 0).moveHistory.at(-1)).toEqual({ round: 1, moveId: 'episodic-replay', target: 0, damaged: [7] });
    expect(s.sides.a.lastMove).toEqual({ actor: 0, moveId: 'segfault', target: 7 });
  });

  it('a target that is no longer legal is re-picked by the move’s default selector', () => {
    const s = fresh();
    run(s, 1, 'ship-it', 7);
    at(s, 7).hp = 0;
    at(s, 7).fainted = true;
    at(s, 8).hp = 100;
    const events = run(s, 0, 'episodic-replay', 0);
    expect(ofType(events, 'MoveUsed').at(-1)).toMatchObject({ moveId: 'ship-it', target: 8 });
  });

  it('uses this action’s draws: the copied move rolls accuracy on the same lo(D3)', () => {
    const s = fresh();
    run(s, 1, 'segfault', 7);
    const events = run(s, 0, 'episodic-replay', 0, { d3lo: 85 });
    expect(ofType(events, 'Missed')).toEqual([{ round: 1, type: 'Missed', actor: 0, target: 7 }]);
  });

  it('fails (Missed) with no allied move yet, and never copies a copy', () => {
    const s = fresh();
    expect(ofType(run(s, 0, 'episodic-replay', 0), 'Missed')).toEqual([{ round: 1, type: 'Missed', actor: 0, target: 0 }]);
    expect(s.sides.a.lastMove).toBeNull();
  });
});

describe('Stochastic Repeat (copy the target’s last move)', () => {
  it('copies the foe’s last move; its original target (on the copier’s side) is illegal, so the default selector picks', () => {
    const s = fresh();
    run(s, 7, 'ship-it', 1);
    at(s, 8).hp = 50;
    const events = run(s, 1, 'stochastic-repeat', 7);
    expect(ofType(events, 'MoveUsed').map((e) => [e.moveId, e.target])).toEqual([['stochastic-repeat', 7], ['ship-it', 8]]);
    expect(ofType(events, 'Damage').map((e) => [e.actor, e.target])).toEqual([[1, 8]]);
  });

  it('a self move is copied onto the copier', () => {
    const s = fresh();
    run(s, 7, 'low-latency', 7);
    const events = run(s, 1, 'stochastic-repeat', 7);
    expect(stages(events)).toEqual([[1, 'latency', 2, 2]]);
  });

  it('fails when the target has not moved', () => {
    const s = fresh();
    expect(ofType(run(s, 1, 'stochastic-repeat', 7), 'Missed')).toEqual([{ round: 1, type: 'Missed', actor: 1, target: 7 }]);
  });
});
