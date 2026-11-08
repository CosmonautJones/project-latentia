import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { activeCardCount, isCompactable, neighbours, toolStepsFor } from '../../src/grid/adjacency.js';
import { cellsOf, type GridLayout, type PlacedPiece } from '../../src/grid/model.js';
import { grid, piece } from './helpers.js';

/** neighbours as it was before C3.5: `x,y` keys of the piece's cells, each other piece tested against them. */
function referenceNeighbours(g: GridLayout, id: string): string[] {
  const p = g.pieces.find((q) => q.id === id);
  if (p === undefined) return [];
  const own = new Set(cellsOf(p).map(([x, y]) => `${x},${y}`));
  const near = ([x, y]: [number, number]): boolean => own.has(`${x + 1},${y}`) || own.has(`${x - 1},${y}`) || own.has(`${x},${y + 1}`) || own.has(`${x},${y - 1}`);
  return g.pieces.filter((o) => o.id !== p.id && cellsOf(o).some(near)).map((o) => o.id);
}

describe('neighbours', () => {
  it('is orthogonal only, in piece order', () => {
    const g = grid(5, 5, [piece('a', 'tool', 1, 1), piece('diag', 'tool', 2, 2), piece('r', 'tool', 2, 1), piece('l', 'tool', 0, 1), piece('u', 'tool', 1, 0)]);
    expect(neighbours(g, 'a')).toEqual(['r', 'l', 'u']);
    expect(neighbours(g, 'diag')).toEqual(['r']);
    expect(neighbours(g, 'missing')).toEqual([]);
  });
  it('matches the keyed reference on any coordinates: safe integers, huge, negative, fractional, NaN', () => {
    const coord = fc.oneof(fc.integer({ min: -3, max: 6 }), fc.constantFrom(2 ** 53 - 1, 2 ** 53 - 2, -(2 ** 53) + 1, 0.5, 1.5, NaN, Infinity, 2 ** 53, -0));
    const kind = fc.constantFrom<Exclude<PlacedPiece['kind'], 'graft'>>('tool', 'skill', 'subagentSlot', 'exampleCard', 'systemPrompt');
    const pieces = fc.array(fc.tuple(kind, coord, coord, fc.constantFrom<PlacedPiece['rotation']>(0, 90, 180, 270)), { minLength: 1, maxLength: 8 });
    fc.assert(
      fc.property(pieces, (ps) => {
        const g = grid(6, 6, ps.map(([k, x, y, r], i) => piece(i % 3 === 2 ? 'dup' : `p${i}`, k, x, y, r)));
        for (const p of g.pieces) expect(neighbours(g, p.id)).toEqual(referenceNeighbours(g, p.id));
      }),
      { numRuns: 500 },
    );
  });
  it('works across multi-cell pieces', () => {
    const g = grid(5, 5, [piece('sk', 'skill', 0, 0), piece('t', 'tool', 1, 1)]);
    expect(neighbours(g, 'sk')).toEqual(['t']);
    expect(neighbours(g, 't')).toEqual(['sk']);
  });
});

describe('toolStepsFor', () => {
  it('counts adjacent Tools only', () => {
    const g = grid(5, 5, [piece('sk', 'skill', 1, 1), piece('t1', 'tool', 0, 1), piece('t2', 'tool', 3, 1), piece('t3', 'tool', 1, 0), piece('far', 'tool', 4, 4), piece('c', 'cache', 1, 2)]);
    expect(toolStepsFor(g, 'sk')).toBe(3);
    expect(toolStepsFor(g, 'missing')).toBe(0);
  });
});

describe('activeCardCount', () => {
  const cards = (n: number) => {
    // ring cells around a slot at (1,1)-(2,2)
    const spots: [number, number][] = [[0, 1], [0, 2], [3, 1], [3, 2], [1, 0], [2, 0], [1, 3], [2, 3]];
    return spots.slice(0, n).map((s, i) => piece(`e${i}`, 'exampleCard', s[0], s[1]));
  };
  it('3 adjacent cards: v1 3, v2 3', () => {
    const g = grid(6, 6, [piece('slot', 'subagentSlot', 1, 1), ...cards(3)]);
    expect(activeCardCount(g, 'slot', 'v1')).toBe(3);
    expect(activeCardCount(g, 'slot', 'v2')).toBe(3);
  });
  it('6 adjacent cards: v1 3, v2 5, v3.5 6, v4 6', () => {
    const g = grid(6, 6, [piece('slot', 'subagentSlot', 1, 1), ...cards(6)]);
    expect(activeCardCount(g, 'slot', 'v1')).toBe(3);
    expect(activeCardCount(g, 'slot', 'v2')).toBe(5);
    expect(activeCardCount(g, 'slot', 'v3.5')).toBe(6);
    expect(activeCardCount(g, 'slot', 'v4')).toBe(6);
  });
  it('8 adjacent cards cap at 7 for v3.5 and 8 for v4', () => {
    const g = grid(6, 6, [piece('slot', 'subagentSlot', 1, 1), ...cards(8)]);
    expect(activeCardCount(g, 'slot', 'v3.5')).toBe(7);
    expect(activeCardCount(g, 'slot', 'v4')).toBe(8);
  });
  it('a shared card counts for both slots; diagonal and non-card pieces do not', () => {
    const g = grid(6, 6, [piece('s1', 'subagentSlot', 0, 0), piece('s2', 'subagentSlot', 3, 0), piece('shared', 'exampleCard', 2, 0), piece('t', 'tool', 2, 1), piece('diag', 'exampleCard', 2, 2)]);
    expect(activeCardCount(g, 's1', 'v4')).toBe(1);
    expect(activeCardCount(g, 's2', 'v4')).toBe(1);
  });
  it('returns 0 for unknown or non-slot ids', () => {
    const g = grid(6, 6, [piece('t', 'tool', 0, 0)]);
    expect(activeCardCount(g, 't', 'v4')).toBe(0);
    expect(activeCardCount(g, 'nope', 'v4')).toBe(0);
  });
});

describe('isCompactable', () => {
  const g = grid(6, 6, [
    piece('sp', 'systemPrompt', 0, 0),
    piece('skill', 'skill', 0, 2),
    piece('tool', 'tool', 4, 4),
    piece('slot', 'subagentSlot', 3, 0),
    piece('nearCache', 'skill', 0, 4),
    piece('cache', 'cache', 0, 5),
  ]);
  it('is false for the System Prompt, 1x1 pieces, cache neighbours and summarized pieces', () => {
    expect(isCompactable(g, 'sp', [])).toBe(false);
    expect(isCompactable(g, 'tool', [])).toBe(false);
    expect(isCompactable(g, 'cache', [])).toBe(false);
    expect(isCompactable(g, 'nearCache', [])).toBe(false);
    expect(isCompactable(g, 'skill', ['skill'])).toBe(false);
    expect(isCompactable(g, 'missing', [])).toBe(false);
  });
  it('is true for a 1x2 Skill and a Subagent Slot', () => {
    expect(isCompactable(g, 'skill', [])).toBe(true);
    expect(isCompactable(g, 'skill', ['other'])).toBe(true);
    expect(isCompactable(g, 'slot', [])).toBe(true);
  });
});
