import { describe, expect, it } from 'vitest';
import { at } from '../helpers.js';
import { fresh, ofType, run } from './kit.js';

// stealStage (Scrapion's Scrape, spec §6): after the hit, moves `stages` of the target's highest positive
// stage (ties in StageStat order) to the user: StageStolen, then StageChanged on the target and the user.

describe('Scrape (stealStage highest, 1)', () => {
  it('steals one stage of the target’s highest positive stage, ties in StageStat order', () => {
    const s = fresh();
    Object.assign(at(s, 7).stages, { compute: 2, latency: 2 });
    const events = run(s, 1, 'scrape', 7);
    expect(events.filter((e) => e.type === 'StageStolen' || e.type === 'StageChanged')).toEqual([
      { round: 1, type: 'StageStolen', actor: 1, target: 7, stat: 'compute', amount: 1 },
      { round: 1, type: 'StageChanged', target: 7, stat: 'compute', delta: -1, stageAfter: 1 },
      { round: 1, type: 'StageChanged', target: 1, stat: 'compute', delta: 1, stageAfter: 1 },
    ]);
  });

  it('the stage leaves the target even when the user is already at +3', () => {
    const s = fresh();
    at(s, 7).stages.evasion = 1;
    at(s, 1).stages.evasion = 3;
    const events = run(s, 1, 'scrape', 7);
    expect(ofType(events, 'StageStolen')).toEqual([{ round: 1, type: 'StageStolen', actor: 1, target: 7, stat: 'evasion', amount: 1 }]);
    expect([at(s, 7).stages.evasion, at(s, 1).stages.evasion]).toEqual([0, 3]);
  });

  it('nothing without a positive stage, or when the move misses', () => {
    const s = fresh();
    at(s, 7).stages.compute = -2;
    expect(ofType(run(s, 1, 'scrape', 7), 'StageStolen')).toEqual([]);
    at(s, 7).stages.compute = 2;
    at(s, 1).stages.accuracy = -3; // Scrape 100 − 30 = 70: lo(D3) = 99 misses
    expect(ofType(run(s, 1, 'scrape', 7, { d3lo: 99 }), 'StageStolen')).toEqual([]);
  });
});
