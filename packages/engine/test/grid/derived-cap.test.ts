import { describe, expect, it, vi } from 'vitest';
import { gridActiveCards } from '../../src/grid/derived.js';
import type { GridLayout, PlacedPiece } from '../../src/grid/model.js';

// C3.5 m1: the grid memo takes its version cap from VERSION_SLOTS, never from a hard-coded version. A version with a
// cap above today's largest (8) is mocked in, with a 3×3 slot ringed by 12 Example Cards: the memo must answer 12.

vi.mock('../../src/grid/adjacency.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/grid/adjacency.js')>();
  return { ...real, VERSION_SLOTS: { ...real.VERSION_SLOTS, v9: 12 } };
});

const at = (id: string, kind: PlacedPiece['kind'], shape: [number, number][], x: number, y: number): PlacedPiece => ({ id, kind, shape, anchor: [x, y], rotation: 0 });
const SQUARE: [number, number][] = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
const RING: [number, number][] = [[1, 0], [2, 0], [3, 0], [0, 1], [0, 2], [0, 3], [4, 1], [4, 2], [4, 3], [1, 4], [2, 4], [3, 4]];

const RINGED: GridLayout = {
  width: 5,
  height: 5,
  pieces: [at('slot', 'subagentSlot', SQUARE, 1, 1), ...RING.map(([x, y], i) => at(`ex${i}`, 'exampleCard', [[0, 0]], x, y))],
};

describe('grid memo version cap (C3.5 m1)', () => {
  it('follows VERSION_SLOTS: a cap above 8 lets all 12 adjacent Example Cards count', () => {
    expect(gridActiveCards(RINGED, 'slot', 'v9' as 'v4')).toBe(12);
    expect(gridActiveCards(RINGED, 'slot', 'v4')).toBe(8);
    expect(gridActiveCards(RINGED, 'slot', 'v1')).toBe(3);
  });
});
