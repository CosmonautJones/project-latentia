import { describe, expect, it } from 'vitest';
import { addObservation, clearAll, forceTokens, freeCells, freeOldestNonJunk, newContext, pay, pushToken, recover } from '../../src/context/store.js';
import { grid, piece } from '../grid/helpers.js';

const types = (e: { type: string }[]) => e.map((x) => x.type);

describe('pay', () => {
  it('fits within free cells without Drift', () => {
    const c = newContext(5);
    const ev = pay(c, 3, 1, 0);
    expect(freeCells(c)).toBe(2);
    expect(c.drift).toBe(0);
    expect(ev).toEqual([{ type: 'ContextAdded', round: 1, target: 0, kind: 'cost', tokens: 3, tokensAfter: 3 }]);
  });
  it('overflows into Drift with one DriftChanged', () => {
    const c = newContext(2);
    const ev = pay(c, 4, 2, 1);
    expect(freeCells(c)).toBe(0);
    expect(c.tokens).toHaveLength(2);
    expect(c.drift).toBe(2);
    expect(types(ev)).toEqual(['ContextAdded', 'DriftChanged']);
  });
  it('caps Drift at 5 and emits nothing when unchanged', () => {
    const c = newContext(0);
    pay(c, 9, 1, 0);
    expect(c.drift).toBe(5);
    expect(pay(c, 1, 1, 0)).toEqual([]);
  });
  it('tags cost tokens with the buff', () => {
    const c = newContext(3);
    pay(c, 2, 1, 0, { stat: 'atk', stages: 2 });
    expect(c.tokens.map((t) => t.buff)).toEqual([{ stat: 'atk', stages: 2 }, { stat: 'atk', stages: 2 }]);
    expect(c.tokens.map((t) => t.seq)).toEqual([0, 1]);
  });
});

describe('forceTokens', () => {
  const g = grid(5, 5, [
    piece('sp', 'systemPrompt', 0, 0),
    piece('sk', 'skill', 0, 1),
    piece('tool', 'tool', 4, 4),
    piece('slot', 'subagentSlot', 2, 2),
  ]);
  it('takes a free cell when available', () => {
    const c = newContext(2);
    const r = forceTokens(c, 1, g, 1, 0);
    expect(r.compactedPieceIds).toEqual([]);
    expect(c.tokens.map((t) => t.kind)).toEqual(['junk']);
  });
  it('compacts the lowest-index compactable piece when full', () => {
    const c = newContext(1);
    pushToken(c, 'cost');
    const r = forceTokens(c, 1, g, 3, 0);
    expect(r.compactedPieceIds).toEqual(['sk']);
    expect(c.summarizedPieces).toEqual(['sk']);
    expect(c.window).toBe(2);
    expect(c.tokens.map((t) => t.kind)).toEqual(['cost', 'junk']);
    expect(types(r.events)).toEqual(['PieceCompacted', 'ContextAdded']);
    expect(c.drift).toBe(0);
  });
  it('compacts a Slot into removedSlots, growing the window by 3', () => {
    const g2 = grid(5, 5, [piece('sp', 'systemPrompt', 0, 0), piece('slot', 'subagentSlot', 2, 2)]);
    const c = newContext(1);
    pushToken(c, 'cost');
    forceTokens(c, 1, g2, 1, 0);
    expect(c.removedSlots).toEqual(['slot']);
    expect(c.window).toBe(4);
  });
  it('does not compact the same piece twice; adds Drift when nothing is compactable', () => {
    const g2 = grid(5, 5, [piece('sp', 'systemPrompt', 0, 0), piece('sk', 'skill', 0, 1)]);
    const c = newContext(1);
    pushToken(c, 'cost');
    forceTokens(c, 1, g2, 1, 0);
    expect(freeCells(c)).toBe(0);
    const r = forceTokens(c, 1, g2, 1, 0);
    expect(r.compactedPieceIds).toEqual([]);
    expect(c.drift).toBe(1);
    expect(types(r.events)).toEqual(['DriftChanged']);
  });
  it('adds Drift for subagents (grid null)', () => {
    const c = newContext(1);
    pushToken(c, 'cost');
    const r = forceTokens(c, 2, null, 1, 0);
    expect(c.drift).toBe(2);
    expect(c.tokens).toHaveLength(1);
    expect(r.compactedPieceIds).toEqual([]);
  });
});

describe('observation, clear, free, recover', () => {
  it('adds an Observation only when a cell is free', () => {
    const c = newContext(1);
    expect(types(addObservation(c, 1, 0))).toEqual(['ContextAdded']);
    expect(addObservation(c, 1, 0)).toEqual([]);
    expect(c.drift).toBe(0);
    expect(c.tokens).toHaveLength(1);
  });
  it('clearAll empties tokens and Drift', () => {
    const c = newContext(3);
    pay(c, 5, 1, 0);
    const ev = clearAll(c, 2, 0);
    expect(c.tokens).toEqual([]);
    expect(c.drift).toBe(0);
    expect(types(ev)).toEqual(['ContextAdded', 'DriftChanged']);
  });
  it('freeOldestNonJunk skips junk', () => {
    const c = newContext(4);
    pushToken(c, 'junk');
    pushToken(c, 'observation');
    pushToken(c, 'cost');
    freeOldestNonJunk(c, 1, 0);
    expect(c.tokens.map((t) => t.kind)).toEqual(['junk', 'cost']);
    const d = newContext(2);
    pushToken(d, 'junk');
    expect(freeOldestNonJunk(d, 1, 0)).toEqual([]);
  });
  it('recover removes the oldest tokens and never goes below 0', () => {
    const c = newContext(4);
    pay(c, 3, 1, 0);
    recover(c, 2, 1, 0);
    expect(c.tokens.map((t) => t.seq)).toEqual([2]);
    recover(c, 5, 1, 0);
    expect(c.tokens).toEqual([]);
    expect(recover(c, 1, 1, 0)).toEqual([]);
  });
});

it('state is plain data', () => {
  const c = newContext(3);
  pay(c, 5, 1, 0, { stat: 'atk', stages: 1 });
  expect(structuredClone(c)).toEqual(c);
});
