import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateGrid } from '../../src/grid/validate.js';
import { grid, piece } from './helpers.js';

// Ruling 75 (reverses Ruling 29): validateGrid takes untrusted JSON. A grid that is not shaped like a
// GridLayout returns errors with code `shape` and a path (relative to the grid; '' is the grid itself);
// it never throws.

type Rec = Record<string, unknown>;

/** A legal L1 grid: System Prompt, a Subagent Slot and a Skill. */
const good = (): Rec =>
  structuredClone(grid(4, 4, [piece('sp', 'systemPrompt', 0, 0), piece('s1', 'subagentSlot', 0, 1), { ...piece('k', 'skill', 2, 1), moveId: 'chain-of-thought' }])) as unknown as Rec;
const pieceAt = (g: Rec, i: number): Rec => (g.pieces as Rec[])[i] as Rec;

const shapePaths = (input: unknown, level: number = 1): string[] => {
  const r = validateGrid(input, level);
  expect(r.ok).toBe(false);
  expect(r.errors.length).toBeGreaterThan(0);
  expect(r.errors.every((e) => e.code === 'shape')).toBe(true);
  return r.errors.map((e) => e.path);
};

describe('validateGrid on malformed input (Ruling 75)', () => {
  it('the base grid is legal', () => {
    expect(validateGrid(good(), 1)).toEqual({ ok: true, errors: [] });
  });

  it.each<[string, unknown, string]>([
    ['null', null, ''],
    ['undefined', undefined, ''],
    ['a number', 4, ''],
    ['a string', 'grid', ''],
    ['an array', [], ''],
    ['{}', {}, 'width'],
  ])('%s → shape at %j', (_name, input, path) => {
    expect(shapePaths(input)).toContain(path);
  });

  it.each<[string, string, (g: Rec) => void]>([
    ['width a string', 'width', (g) => (g.width = '4')],
    ['height missing', 'height', (g) => delete g.height],
    ['pieces missing', 'pieces', (g) => delete g.pieces],
    ['pieces an object', 'pieces', (g) => (g.pieces = { 0: piece('sp', 'systemPrompt', 0, 0) })],
    ['a piece null', 'pieces[1]', (g) => ((g.pieces as unknown[])[1] = null)],
    ['a piece a number', 'pieces[0]', (g) => ((g.pieces as unknown[])[0] = 5)],
    ['a piece an array', 'pieces[2]', (g) => ((g.pieces as unknown[])[2] = [])],
    ['sparse pieces', 'pieces[1]', (g) => delete (g.pieces as unknown[])[1]],
    ['a piece id a number', 'pieces[0].id', (g) => (pieceAt(g, 0).id = 3)],
    ['a piece id missing', 'pieces[1].id', (g) => delete pieceAt(g, 1).id],
    ['a piece kind null', 'pieces[1].kind', (g) => (pieceAt(g, 1).kind = null)],
    ['a piece moveId a number', 'pieces[2].moveId', (g) => (pieceAt(g, 2).moveId = 12)],
    ['a piece subagentId an object', 'pieces[1].subagentId', (g) => (pieceAt(g, 1).subagentId = {})],
  ])('%s → shape at %s', (_name, path, edit) => {
    const g = good();
    edit(g);
    expect(shapePaths(g)).toContain(path);
  });

  it('a level that is not a number → shape at level', () => {
    expect(shapePaths(good(), 'one' as unknown as number)).toEqual(['level']);
  });

  it('a well-typed piece with bad geometry is still reported as before (shape at the piece, validation goes on)', () => {
    const g = good();
    pieceAt(g, 2).shape = 'x';
    pieceAt(g, 0).kind = 'tool';
    const r = validateGrid(g, 1);
    expect(r.errors.map((e) => [e.code, e.path])).toEqual([
      ['shape', 'pieces[0]'],
      ['shape', 'pieces[2]'],
      ['systemPromptCount', 'pieces'],
    ]);
  });

  it('never throws on arbitrary input', () => {
    const any = fc.anything({ withNullPrototype: true, withSparseArray: true, withBoxedValues: true, withMap: true, withSet: true, withBigInt: true, withDate: true, withTypedArray: true, withObjectString: true });
    fc.assert(
      fc.property(any, fc.oneof(fc.integer({ min: -5, max: 120 }), fc.double()), (v, level) => {
        expect(validateGrid(v, level).ok).toBe(false);
      }),
      { numRuns: 500 },
    );
  });

  it('never throws on a legal grid with one field replaced by arbitrary data', () => {
    const paths: string[][] = [['width'], ['height'], ['pieces'], ['pieces', '0'], ['pieces', '1', 'id'], ['pieces', '1', 'kind'], ['pieces', '1', 'shape'], ['pieces', '1', 'anchor'], ['pieces', '1', 'rotation'], ['pieces', '2', 'moveId'], ['pieces', '1', 'subagentId'], ['pieces', '2', 'shape', '0']];
    const any = fc.anything({ withNullPrototype: true, withSparseArray: true, withBoxedValues: true, withBigInt: true });
    fc.assert(
      fc.property(fc.constantFrom(...paths), any, (path, v) => {
        const g = good();
        let at: Rec = g;
        for (const k of path.slice(0, -1)) at = at[k] as Rec;
        at[path[path.length - 1] as string] = v;
        expect(() => validateGrid(g, 1)).not.toThrow();
      }),
      { numRuns: 500 },
    );
  });
});
