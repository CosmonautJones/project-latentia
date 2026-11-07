import { describe, expect, it } from 'vitest';
import { at } from '../helpers.js';
import { fresh, ofType, run } from './kit.js';

describe('stage: add', () => {
  it('clamps at +3: StageChanged carries the actual change and the new stage; none once capped', () => {
    const s = fresh();
    expect(ofType(run(s, 1, 'low-latency', 1), 'StageChanged')).toEqual([{ round: 1, type: 'StageChanged', target: 1, stat: 'latency', delta: 2, stageAfter: 2 }]);
    expect(ofType(run(s, 1, 'low-latency', 1), 'StageChanged')).toEqual([{ round: 1, type: 'StageChanged', target: 1, stat: 'latency', delta: 1, stageAfter: 3 }]);
    expect(ofType(run(s, 1, 'low-latency', 1), 'StageChanged')).toEqual([]);
    expect(at(s, 1).stages.latency).toBe(3);
  });

  it('clamps at −3 on a target debuff', () => {
    const s = fresh();
    at(s, 7).stages.latency = -2;
    expect(ofType(run(s, 1, 'tangle', 7), 'StageChanged')).toEqual([{ round: 1, type: 'StageChanged', target: 7, stat: 'latency', delta: -1, stageAfter: -3 }]);
    expect(ofType(run(s, 1, 'tangle', 7), 'StageChanged')).toEqual([]);
    expect(at(s, 7).stages.latency).toBe(-3);
  });

  it('applies each listed stage in order (Hype Train +2 Compute, −1 accuracy)', () => {
    const s = fresh();
    expect(ofType(run(s, 1, 'hype-train', 1), 'StageChanged').map((e) => [e.stat, e.delta])).toEqual([
      ['compute', 2],
      ['accuracy', -1],
    ]);
  });

  it('everyone: Permissive License raises every on-field creature, never the bench', () => {
    const s = fresh();
    const targets = ofType(run(s, 2, 'permissive-license', 2), 'StageChanged').map((e) => e.target);
    expect(targets).toEqual([0, 1, 2, 6, 7, 8]);
    expect(at(s, 3).stages.compute).toBe(0);
  });
});

describe('stage: clear', () => {
  it('Fact Check removes only positive stages', () => {
    const s = fresh();
    Object.assign(at(s, 7).stages, { compute: 2, robustness: -1, evasion: 1 });
    expect(ofType(run(s, 1, 'fact-check', 7), 'StageChanged')).toEqual([
      { round: 1, type: 'StageChanged', target: 7, stat: 'compute', delta: -2, stageAfter: 0 },
      { round: 1, type: 'StageChanged', target: 7, stat: 'evasion', delta: -1, stageAfter: 0 },
    ]);
    expect(at(s, 7).stages).toMatchObject({ compute: 0, robustness: -1, evasion: 0 });
  });
});

describe('stage buffs and context (Ruling 47)', () => {
  it("a buff move's cost tokens carry the buff tag; summarizing one costs the buff 1 stage", () => {
    const s = fresh();
    run(s, 1, 'step-back-prompt', 1); // +1 Compute, +1 accuracy; cost 1
    expect(at(s, 1).context.tokens).toEqual([{ kind: 'cost', buff: { stat: 'compute', stages: 1 }, seq: 0 }]);
    run(s, 1, 'ship-it', 7); // an untagged cost token
    expect(at(s, 1).context.tokens[1]).toEqual({ kind: 'cost', seq: 1 });
    const compact = run(s, 1, 'compact', 1);
    expect(ofType(compact, 'Compacted')).toEqual([{ round: 1, type: 'Compacted', target: 1, tokensBefore: 2, tokensAfter: 1 }]);
    expect(ofType(compact, 'StageChanged')).toEqual([{ round: 1, type: 'StageChanged', target: 1, stat: 'compute', delta: -1, stageAfter: 0 }]);
  });

  it('a summarized buff never pushes a stage below 0', () => {
    const s = fresh();
    run(s, 1, 'step-back-prompt', 1);
    run(s, 1, 'ship-it', 7);
    at(s, 1).stages.compute = -1;
    expect(ofType(run(s, 1, 'compact', 1), 'StageChanged')).toEqual([]);
    expect(at(s, 1).stages.compute).toBe(-1);
  });

  it('debuff and damage moves carry no tag', () => {
    const s = fresh();
    run(s, 1, 'tangle', 7);
    expect(at(s, 1).context.tokens.every((t) => t.buff === undefined)).toBe(true);
  });
});
