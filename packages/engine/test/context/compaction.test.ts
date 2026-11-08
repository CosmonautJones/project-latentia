import { describe, expect, it } from 'vitest';
import { compact } from '../../src/context/compaction.js';
import { newContext, pay } from '../../src/context/store.js';

const kinds = (c: ReturnType<typeof newContext>) => c.tokens.map((t) => t.kind);

describe('compact', () => {
  it('pairs the six oldest into 3 summaries and leaves Drift to the move\'s own cure effect', () => {
    const c = newContext(8);
    pay(c, 8, 1, 0);
    pay(c, 3, 1, 0); // drift 3
    const { events: ev } = compact(c, 2, 0);
    expect(kinds(c)).toEqual(['summary', 'summary', 'summary', 'cost', 'cost']);
    expect(c.drift).toBe(3);
    expect(ev.map((e) => e.type)).toEqual(['Compacted']);
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
  it('reports summarized buffs (never emits StageChanged), leaving unsummarized tags alone', () => {
    const c = newContext(8);
    pay(c, 2, 1, 0, { stat: 'atk', stages: 1 });
    pay(c, 4, 1, 0);
    pay(c, 1, 1, 0, { stat: 'spd', stages: 1 }); // 7th: not summarized
    const r = compact(c, 3, 1);
    expect(r.events.some((e) => e.type === 'StageChanged')).toBe(false);
    expect(r.summarizedBuffs).toEqual([{ stat: 'atk', stages: 1 }, { stat: 'atk', stages: 1 }]);
    expect(c.tokens[c.tokens.length - 1]?.buff?.stat).toBe('spd');
  });
  it('with 0 tokens emits Compacted 0 -> 0 and changes nothing', () => {
    const c = newContext(4);
    const r = compact(c, 1, 0);
    expect(r.events).toEqual([{ type: 'Compacted', round: 1, target: 0, tokensBefore: 0, tokensAfter: 0 }]);
    expect(r.summarizedBuffs).toEqual([]);
    expect(c.tokens).toEqual([]);
  });
  it('with 1 token leaves it as is', () => {
    const c = newContext(4);
    pay(c, 1, 1, 0, { stat: 'atk', stages: 1 });
    const r = compact(c, 1, 0);
    expect(kinds(c)).toEqual(['cost']);
    expect(r.events).toEqual([{ type: 'Compacted', round: 1, target: 0, tokensBefore: 1, tokensAfter: 1 }]);
    expect(r.summarizedBuffs).toEqual([]);
  });
});
