import { describe, expect, it } from 'vitest';
import { SPECIES, SPECIES_IDS } from '../../src/content/species.js';
import { cellsOf, GRID_SIZE_BY_LEVEL, gridSizeFor, type PlacedPiece } from '../../src/grid/model.js';
import { validateGrid } from '../../src/grid/validate.js';
import { grid, piece } from './helpers.js';

const base = () => [
  piece('sp', 'systemPrompt', 0, 0),
  piece('sk1', 'skill', 0, 1),
  piece('tl', 'tool', 2, 1),
  piece('slot', 'subagentSlot', 2, 2),
  piece('ex', 'exampleCard', 0, 3),
];
const codes = (r: { errors: { code: string }[] }) => r.errors.map((e) => e.code).sort();

describe('grid sizes', () => {
  it('maps levels to sizes', () => {
    expect(GRID_SIZE_BY_LEVEL).toEqual([[1, 4, 4], [4, 5, 4], [7, 5, 5], [10, 6, 5], [13, 6, 6]]);
    expect(gridSizeFor(1)).toEqual({ width: 4, height: 4 });
    expect(gridSizeFor(3)).toEqual({ width: 4, height: 4 });
    expect(gridSizeFor(4)).toEqual({ width: 5, height: 4 });
    expect(gridSizeFor(9)).toEqual({ width: 5, height: 5 });
    expect(gridSizeFor(12)).toEqual({ width: 6, height: 5 });
    expect(gridSizeFor(20)).toEqual({ width: 6, height: 6 });
  });
});

describe('validateGrid grid size', () => {
  it('enforces the size for the level', () => {
    expect(codes(validateGrid(grid(6, 6, [piece('sp', 'systemPrompt', 0, 0)]), 1))).toEqual(['gridSize']);
    expect(validateGrid(grid(5, 4, [piece('sp', 'systemPrompt', 0, 0)]), 4).ok).toBe(true);
    expect(codes(validateGrid(grid(50, 50, [piece('sp', 'systemPrompt', 0, 0)]), 1))).toEqual(['gridSize']);
  });
  it('rejects non-positive-integer dimensions', () => {
    expect(codes(validateGrid(grid(Number.NaN, 4, [piece('sp', 'systemPrompt', 0, 0)]), 1))).toContain('gridSize');
    expect(codes(validateGrid(grid(4, 0, [piece('sp', 'systemPrompt', 0, 0)]), 1))).toContain('gridSize');
    expect(codes(validateGrid(grid(4.5, 4, [piece('sp', 'systemPrompt', 0, 0)]), 1))).toContain('gridSize');
  });
});

describe('validateGrid', () => {
  it('accepts a legal 4x4 loadout with headroom 5', () => {
    expect(validateGrid(grid(4, 4, base()), 1)).toEqual({ ok: true, errors: [] });
  });

  it('rejects a second Skill with headroomFloor', () => {
    const r = validateGrid(grid(4, 4, [...base(), piece('sk2', 'skill', 0, 2)]), 1);
    expect(codes(r)).toEqual(['headroomFloor']);
  });

  it('rejects two System Prompts', () => {
    const g = grid(6, 6, [...base(), piece('sp2', 'systemPrompt', 3, 0)]);
    expect(codes(validateGrid(g, 13))).toEqual(['systemPromptCount']);
  });

  it('rejects zero System Prompts', () => {
    expect(codes(validateGrid(grid(4, 4, [piece('sk', 'skill', 0, 0)]), 1))).toEqual(['systemPromptCount']);
  });

  it('rejects five Skills', () => {
    const skills = [0, 1, 2, 3, 4].map((i) => piece(`s${i}`, 'skill', i % 2 === 0 ? 0 : 2, i === 4 ? 3 : i < 2 ? 1 : 2));
    const g = grid(6, 6, [piece('sp', 'systemPrompt', 0, 0), piece('a', 'skill', 0, 1), piece('b', 'skill', 2, 1), piece('c', 'skill', 0, 2), piece('d', 'skill', 2, 2), piece('e', 'skill', 0, 3)]);
    expect(skills).toHaveLength(5);
    expect(codes(validateGrid(g, 13))).toEqual(['skillCount']);
  });

  it('rejects overlap', () => {
    const g = grid(4, 4, [piece('sp', 'systemPrompt', 0, 0), piece('t', 'tool', 1, 0)]);
    expect(codes(validateGrid(g, 1))).toEqual(['overlap']);
  });

  it('rejects out of bounds', () => {
    const g = grid(4, 4, [piece('sp', 'systemPrompt', 2, 0)]);
    expect(codes(validateGrid(g, 1))).toEqual(['bounds']);
    const neg = grid(4, 4, [piece('sp', 'systemPrompt', 0, 0), piece('t', 'tool', -1, 2)]);
    expect(codes(validateGrid(neg, 1))).toEqual(['bounds']);
  });

  it('returns every error together', () => {
    const g = grid(4, 4, [
      piece('sp', 'systemPrompt', 0, 0),
      piece('sp2', 'systemPrompt', 1, 0),
      piece('s', 'skill', 3, 3),
      piece('slot', 'subagentSlot', 0, 1),
      piece('slot2', 'subagentSlot', 2, 1),
      piece('x', 'subagentSlot', 0, 2),
    ]);
    expect(codes(validateGrid(g, 1))).toEqual(['bounds', 'headroomFloor', 'overlap', 'overlap', 'systemPromptCount']);
  });

  it('rejects a duplicate id and a wrong shape', () => {
    const g = grid(4, 4, [piece('sp', 'systemPrompt', 0, 0), piece('sp', 'tool', 0, 1)]);
    expect(codes(validateGrid(g, 1))).toEqual(['duplicateId']);
    const wrong: PlacedPiece = { id: 'k', kind: 'skill', shape: [[0, 0], [1, 1]], anchor: [0, 1], rotation: 0 };
    expect(codes(validateGrid(grid(4, 4, [piece('sp', 'systemPrompt', 0, 0), wrong]), 1))).toEqual(['shape']);
  });

  it('accepts canonical shapes given in a rotated form, and rejects bad rotation', () => {
    const vertical: PlacedPiece = { id: 'k', kind: 'skill', shape: [[0, 0], [0, 1]], anchor: [0, 1], rotation: 0 };
    expect(validateGrid(grid(4, 4, [piece('sp', 'systemPrompt', 0, 0), vertical]), 1).ok).toBe(true);
    const odd = { ...piece('k', 'skill', 0, 1), rotation: 45 } as unknown as PlacedPiece;
    expect(codes(validateGrid(grid(4, 4, [piece('sp', 'systemPrompt', 0, 0), odd]), 1))).toEqual(['shape']);
  });

  it('does not throw on malformed pieces; reports a shape error and keeps validating', () => {
    const sp = piece('sp', 'systemPrompt', 0, 0);
    const mk = (over: Record<string, unknown>) => ({ ...piece('k', 'tool', 0, 1), ...over }) as unknown as PlacedPiece;
    const cases: PlacedPiece[] = [
      mk({ kind: 'banana' }),
      mk({ kind: 'toString' }),
      mk({ shape: undefined }),
      mk({ anchor: undefined }),
    ];
    for (const bad of cases) {
      const r = validateGrid(grid(4, 4, [sp, bad]), 1);
      expect(codes(r)).toEqual(['shape']);
    }
    // the rest of the grid is still validated: a second System Prompt is reported alongside the shape error
    const both = validateGrid(grid(4, 4, [sp, mk({ kind: 'banana' }), piece('sp2', 'systemPrompt', 0, 2)]), 1);
    expect(codes(both)).toEqual(['shape', 'systemPromptCount']);
  });

  it('validates every species graft shape and rejects disconnected or oversize grafts', () => {
    for (const id of SPECIES_IDS) {
      const g: PlacedPiece = { id: 'g', kind: 'graft', shape: SPECIES[id].graftShape, anchor: [0, 1], rotation: 0, moveId: 'm' };
      expect(validateGrid(grid(5, 5, [piece('sp', 'systemPrompt', 0, 0), g]), 7).ok).toBe(true);
    }
    const split: PlacedPiece = { id: 'g', kind: 'graft', shape: [[0, 0], [1, 0], [3, 0]], anchor: [0, 1], rotation: 0 };
    expect(codes(validateGrid(grid(5, 5, [piece('sp', 'systemPrompt', 0, 0), split]), 7))).toEqual(['shape']);
    const five: PlacedPiece = { id: 'g', kind: 'graft', shape: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], anchor: [0, 1], rotation: 0 };
    expect(codes(validateGrid(grid(6, 6, [piece('sp', 'systemPrompt', 0, 0), five]), 13))).toEqual(['shape']);
  });
});

describe('cellsOf', () => {
  const L: PlacedPiece = { id: 'g', kind: 'graft', shape: [[0, 0], [0, 1], [1, 1]], anchor: [2, 1], rotation: 0 };
  const sorted = (c: [number, number][]) => c.map((v) => v.join(',')).sort();

  it('applies the anchor at rotation 0', () => {
    expect(sorted(cellsOf(L))).toEqual(['2,1', '2,2', '3,2']);
  });
  it('rotates an L-tromino 90 degrees clockwise, normalized to the anchor', () => {
    // (x,y)->(-y,x): (0,0),(-1,0),(-1,1) -> normalize +1 -> (1,0),(0,0),(0,1)
    expect(sorted(cellsOf({ ...L, rotation: 90 }))).toEqual(['2,1', '2,2', '3,1']);
  });
  it('rotates 180 and 270', () => {
    expect(sorted(cellsOf({ ...L, rotation: 180 }))).toEqual(['2,1', '3,1', '3,2']);
    expect(sorted(cellsOf({ ...L, rotation: 270 }))).toEqual(['2,2', '3,1', '3,2']);
  });
  it('turns a horizontal line vertical at 90', () => {
    expect(cellsOf({ ...piece('sp', 'systemPrompt', 1, 0), rotation: 90 })).toEqual([[1, 0], [1, 1], [1, 2]]);
  });
});
