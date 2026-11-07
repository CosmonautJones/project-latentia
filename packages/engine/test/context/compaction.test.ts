import { describe, expect, it } from 'vitest';
import { compact } from '../../src/context/compaction.js';
import { newContext, pay } from '../../src/context/store.js';

const kinds = (c: ReturnType<typeof newContext>) => c.tokens.map((t) => t.kind);

describe('compact', () => {
  it('pairs the six oldest into 3 summaries and clears 1 Drift', () => {
    const c = newContext(8);
    pay(c, 8, 1, 0);
    pay(c, 3, 1, 0); // drift 3
    const ev = compact(c, 2, 0);
    expect(kinds(c)).toEqual(['summary', 'summary', 'summary', 'cost', 'cost']);
    expect(c.drift).toBe(2);
    expect(ev.map((e) => e.type)).toEqual(['Compacted', 'DriftChanged']);
    expect(ev[0]).toEqual({ type: 'Compacted', round: 2, target: 0, tokensBefore: 8, tokensAfter: 5 });
  });
  it('with 5 tokens pairs (1,2),(3,4) and leaves the odd one', () => {
    const c = newContext(8);
    pay(c, 5, 1, 0);
    compact(c, 1, 0);
    expect(kinds(c)).toEqual(['summary', 'summary', 'cost']);
  });
  it('summaries can be compacted again', () => {
    const c = newContext(8);
    pay(c, 6, 1, 0);
    compact(c, 1, 0);
    compact(c, 1, 0);
    expect(kinds(c)).toEqual(['summary', 'summary']);
  });
  it('emits StageChanged -1 for each summarized buff-tagged token only', () => {
    const c = newContext(8);
    pay(c, 2, 1, 0, { stat: 'atk', stages: 1 });
    pay(c, 4, 1, 0);
    pay(c, 1, 1, 0, { stat: 'spd', stages: 1 }); // 7th: not summarized
    const ev = compact(c, 3, 1);
    const stages = ev.filter((e) => e.type === 'StageChanged');
    expect(stages).toEqual([
      { type: 'StageChanged', round: 3, target: 1, stat: 'atk', delta: -1, stageAfter: 0 },
      { type: 'StageChanged', round: 3, target: 1, stat: 'atk', delta: -1, stageAfter: 0 },
    ]);
    expect(c.tokens[c.tokens.length - 1]?.buff?.stat).toBe('spd');
  });
  it('emits no DriftChanged at zero Drift', () => {
    const c = newContext(4);
    pay(c, 2, 1, 0);
    expect(compact(c, 1, 0).map((e) => e.type)).toEqual(['Compacted']);
  });
});
