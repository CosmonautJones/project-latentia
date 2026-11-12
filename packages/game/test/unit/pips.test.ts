import { describe, expect, it } from 'vitest';
import { contextPips, costView } from '../../src/battle/pips.js';

// Ruling V13: context as pips, capacity as empty pips; each move's cost as pips; an unaffordable move dimmed with why.
describe('context pips', () => {
  it('one pip per cell, used first, the free capacity as empty pips', () => {
    expect(contextPips(5, 12)).toEqual([...Array(5).fill('used'), ...Array(7).fill('free')]);
    expect(contextPips(0, 3)).toEqual(['free', 'free', 'free']);
    expect(contextPips(14, 12)).toEqual(Array(12).fill('used'));
  });
});

describe('cost pips and the reason line', () => {
  it('a move that fits: every pip fits, no reason', () => {
    expect(costView(3, 7)).toEqual({ pips: ['fits', 'fits', 'fits'], affordable: true, reason: null });
    expect(costView(0, 0)).toEqual({ pips: [], affordable: true, reason: null });
  });
  it('a move that does not fit is dimmed with "needs N context", the pips past the free cells marked over', () => {
    expect(costView(3, 1)).toEqual({ pips: ['fits', 'over', 'over'], affordable: false, reason: 'needs 3 context, 1 free' });
  });
});
