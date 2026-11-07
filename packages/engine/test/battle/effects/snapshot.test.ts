import { describe, expect, it } from 'vitest';
import { submitRound } from '../../../src/battle/round.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { at } from '../helpers.js';
import { fresh, ofType, run } from './kit.js';

// snapshot / revert (spec §6): Save State saves the user's HP and reverts its first KO within 3 rounds;
// Screenshot saves the target's stages and the next use reverts them.

const koBy = (s: ReturnType<typeof fresh>, victim: number): BattleEvent[] => {
  at(s, victim).hp = 1;
  return run(s, victim === 1 ? 7 : 1, 'ship-it', victim);
};

describe('Save State (snapshot hp, 3 rounds, revert on first KO)', () => {
  it('the first KO within 3 rounds reverts HP to the snapshot instead of fainting', () => {
    const s = fresh();
    at(s, 1).hp = 420;
    run(s, 1, 'save-state', 1);
    expect(at(s, 1).snapshots).toEqual([{ owner: 1, what: 'hp', hp: 420, lastRound: 3, onKo: true }]);
    s.round = 3;
    const events = koBy(s, 1);
    expect(ofType(events, 'Damage').at(-1)).toMatchObject({ target: 1, hpAfter: 0 });
    expect(ofType(events, 'Healed')).toEqual([{ round: 3, type: 'Healed', target: 1, amount: 420, hpAfter: 420 }]);
    expect(ofType(events, 'Fainted')).toEqual([]);
    expect(at(s, 1)).toMatchObject({ hp: 420, fainted: false, snapshots: [] });
    // Only the first KO: the next one faints.
    expect(ofType(koBy(s, 1), 'Fainted')).toEqual([{ round: 3, type: 'Fainted', target: 1 }]);
  });

  it('no revert after the 3 rounds', () => {
    const s = fresh();
    run(s, 1, 'save-state', 1);
    s.round = 4;
    expect(ofType(koBy(s, 1), 'Fainted')).toHaveLength(1);
  });

  it('a Deprecated KO at end of round is reverted from the HP the creature had (no Damage for the tick)', () => {
    const s = fresh();
    run(s, 0, 'save-state', 0);
    s.round = 0;
    at(s, 0).hp = 50;
    at(s, 0).statuses.push({ id: 'deprecated', remaining: 1 });
    const r = submitRound(s, { a: { temperature: 2, action: { kind: 'none' } } });
    if ('error' in r) throw new Error(r.error.message);
    const before = ofType(r.events, 'Damage').filter((e) => e.target === 0).at(-1)?.hpAfter ?? 50;
    expect(before).toBeGreaterThan(0); // it was the tick, not a hit, that KO'd it
    expect(ofType(r.events, 'Healed').filter((e) => e.target === 0)).toEqual([{ round: 1, type: 'Healed', target: 0, amount: 500 - before, hpAfter: 500 }]);
    expect(ofType(r.events, 'Fainted')).toEqual([]);
    expect(at(r.state, 0)).toMatchObject({ hp: 500, fainted: false, statuses: [] });
  });

  it('using it again replaces the snapshot', () => {
    const s = fresh();
    run(s, 1, 'save-state', 1);
    s.round = 2;
    at(s, 1).hp = 300;
    run(s, 1, 'save-state', 1);
    expect(at(s, 1).snapshots).toEqual([{ owner: 1, what: 'hp', hp: 300, lastRound: 4, onKo: true }]);
  });
});

describe('Screenshot (revert stages, else snapshot)', () => {
  it('the first use saves the target’s stages; the next use reverts them, then it saves again', () => {
    const s = fresh();
    at(s, 7).stages.compute = 1;
    const first = run(s, 0, 'screenshot', 7);
    expect(ofType(first, 'StageChanged')).toEqual([]);
    expect(at(s, 7).snapshots).toEqual([{ owner: 0, what: 'stages', stages: { compute: 1, robustness: 0, latency: 0, accuracy: 0, evasion: 0 }, lastRound: null, onKo: false }]);
    at(s, 7).stages.compute = 3;
    at(s, 7).stages.robustness = -1;
    const second = run(s, 0, 'screenshot', 7);
    expect(ofType(second, 'StageChanged')).toEqual([
      { round: 1, type: 'StageChanged', target: 7, stat: 'compute', delta: -2, stageAfter: 1 },
      { round: 1, type: 'StageChanged', target: 7, stat: 'robustness', delta: 1, stageAfter: 0 },
    ]);
    expect(at(s, 7).snapshots).toEqual([]);
    run(s, 0, 'screenshot', 7);
    expect(at(s, 7).snapshots).toHaveLength(1);
  });

  it('another user’s snapshot of the same target is its own', () => {
    const s = fresh();
    run(s, 0, 'screenshot', 7);
    at(s, 7).stages.compute = 2;
    expect(ofType(run(s, 1, 'screenshot', 7), 'StageChanged')).toEqual([]);
    expect(at(s, 7).snapshots.map((x) => x.owner)).toEqual([0, 1]);
  });
});
