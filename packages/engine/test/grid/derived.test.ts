import { describe, expect, it } from 'vitest';
import { activeCardCount, toolStepsFor, VERSION_SLOTS } from '../../src/grid/adjacency.js';
import { gridActiveCards, gridMovePiece, gridToolSteps } from '../../src/grid/derived.js';
import type { GridLayout } from '../../src/grid/model.js';
import { buildGrid, GRID_TEMPLATES } from '../helpers/arbitraries.js';
import { grid, piece } from './helpers.js';

const VERSIONS = Object.keys(VERSION_SLOTS) as (keyof typeof VERSION_SLOTS)[];

/** Every template filled for two orchestrators, plus a slot ringed by nine Example Cards (more than any cap). */
const GRIDS: GridLayout[] = [
  ...GRID_TEMPLATES.flatMap((t, i) => ['vibrat', 'sagelet'].map((sp) => buildGrid(t, sp, ['x', 'y'], i))),
  grid(6, 6, [
    piece('slot', 'subagentSlot', 1, 1),
    ...[[1, 0], [2, 0], [0, 1], [0, 2], [3, 1], [3, 2], [1, 3], [2, 3], [0, 0]].map(([x, y], i) => piece(`ex${i}`, 'exampleCard', x as number, y as number)),
  ]),
];

describe('grid memo (C3.5)', () => {
  it('answers what the uncached adjacency functions compute, asked twice, for every piece and version', () => {
    for (const g of GRIDS) {
      for (let pass = 0; pass < 2; pass++) {
        for (const p of [...g.pieces, piece('missing', 'tool', 9, 9)]) {
          for (const v of VERSIONS) expect(gridActiveCards(g, p.id, v)).toBe(activeCardCount(g, p.id, v));
          expect(gridToolSteps(g, p.id)).toBe(toolStepsFor(g, p.id));
          const holder = p.moveId === undefined ? null : g.pieces.find((q) => (q.kind === 'skill' || q.kind === 'graft') && q.moveId === p.moveId);
          if (p.moveId !== undefined) expect(gridMovePiece(g, p.moveId)).toBe(holder);
        }
        expect(gridMovePiece(g, 'not-a-move')).toBeNull();
      }
    }
  });

  it('caps the ringed slot by version: 3 / 5 / 7 / 8', () => {
    const ringed = GRIDS.at(-1) as GridLayout;
    expect(VERSIONS.map((v) => gridActiveCards(ringed, 'slot', v))).toEqual([3, 5, 7, 8]);
  });

  it('is per grid object: a clone answers from its own pieces, never from the original’s entry', () => {
    const g = grid(4, 4, [piece('sk', 'skill', 0, 0), piece('t1', 'tool', 2, 0), piece('slot', 'subagentSlot', 0, 1), piece('ex', 'exampleCard', 2, 1)]);
    expect(gridToolSteps(g, 'sk')).toBe(1);
    expect(gridActiveCards(g, 'slot', 'v4')).toBe(1);
    const clone = structuredClone(g) as { pieces: unknown[] } & GridLayout;
    clone.pieces.push(piece('t2', 'tool', 0, 3), piece('ex2', 'exampleCard', 2, 2));
    clone.pieces.splice(1, 1); // drop t1
    expect(gridToolSteps(clone, 'sk')).toBe(0);
    expect(gridActiveCards(clone, 'slot', 'v4')).toBe(2);
    expect(gridToolSteps(g, 'sk')).toBe(1);
  });
});
