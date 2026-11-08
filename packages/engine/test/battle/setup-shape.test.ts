import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateSetup } from '../../src/battle/setup.js';
import type { BattleSetup } from '../../src/battle/setup.js';
import { grid, piece } from '../grid/helpers.js';
import { gridlessSetup, mon } from './helpers.js';

// Ruling 75 (reverses Ruling 29): validateSetup takes untrusted JSON. Any malformed input returns errors
// with code `shape` and a path; it never throws.

/** A legal setup whose side A is gridded (L1 4x4: System Prompt and two bound Subagent Slots). */
function good(): Record<string, unknown> {
  const g = grid(4, 4, [piece('sp', 'systemPrompt', 0, 0), { ...piece('s1', 'subagentSlot', 0, 1), subagentId: 'a-act1' }, { ...piece('s2', 'subagentSlot', 2, 1), subagentId: 'a-act2' }]);
  const setup: BattleSetup = gridlessSetup({ orchestrator: { ...mon('a-orch', 'sagelet', 1), moves: [] }, grid: g });
  return structuredClone(setup) as unknown as Record<string, unknown>;
}

type Rec = Record<string, unknown>;
const sideA = (s: Rec): Rec => s.a as Rec;
const act0 = (s: Rec): Rec => (sideA(s).active as Rec[])[0] as Rec;
const gridA = (s: Rec): Rec => sideA(s).grid as Rec;

const shapePaths = (input: unknown): string[] => {
  const r = validateSetup(input);
  expect(r.ok).toBe(false);
  expect(r.errors.length).toBeGreaterThan(0);
  expect(r.errors.every((e) => e.code === 'shape')).toBe(true);
  return r.errors.map((e) => e.path);
};

describe('validateSetup on malformed input (Ruling 75)', () => {
  it('the base setup is legal', () => {
    expect(validateSetup(good())).toEqual({ ok: true, errors: [] });
  });

  it.each<[string, unknown, string]>([
    ['{}', {}, 'a'],
    ['null', null, ''],
    ['undefined', undefined, ''],
    ['a number', 5, ''],
    ['a string', 'x', ''],
    ['an array', [], ''],
  ])('%s → shape at %j', (_name, input, path) => {
    expect(shapePaths(input)).toContain(path);
  });

  it.each<[string, string, (s: Rec) => void]>([
    ['side b missing', 'b', (s) => delete s.b],
    ['side a a string', 'a', (s) => (s.a = 'a')],
    ['kind missing', 'kind', (s) => delete s.kind],
    ['kind not a setup kind', 'kind', (s) => (s.kind = 'pvp')],
    ['orchestrator null', 'a.orchestrator', (s) => (sideA(s).orchestrator = null)],
    ['active not an array', 'a.active', (s) => (sideA(s).active = {})],
    ['bench a string', 'a.bench', (s) => (sideA(s).bench = 'x')],
    ['an active entry null', 'a.active[0]', (s) => ((sideA(s).active as unknown[])[0] = null)],
    ['a sparse active array', 'a.active[0]', (s) => delete (sideA(s).active as unknown[])[0]],
    ['moves missing', 'a.active[0].moves', (s) => delete act0(s).moves],
    ['moves holding a number', 'a.active[0].moves[1]', (s) => (act0(s).moves = ['ship-it', 3])],
    ['id a number', 'a.active[0].id', (s) => (act0(s).id = 1)],
    ['species null', 'a.active[0].species', (s) => (act0(s).species = null)],
    ['level a string', 'a.active[0].level', (s) => (act0(s).level = '5')],
    ['version a number', 'a.active[0].version', (s) => (act0(s).version = 1)],
    ['generalization a string', 'a.active[0].generalization', (s) => (act0(s).generalization = '80')],
    ['trainedTemperature null', 'a.active[0].trainedTemperature', (s) => (act0(s).trainedTemperature = null)],
    ['recordedFoes not an array', 'a.active[0].recordedFoes', (s) => (act0(s).recordedFoes = 'b-orch')],
    ['recordedFoes holding null', 'a.active[0].recordedFoes[0]', (s) => (act0(s).recordedFoes = [null])],
    ['grid a number', 'a.grid', (s) => (sideA(s).grid = 5)],
    ['grid missing', 'a.grid', (s) => delete sideA(s).grid],
    ['grid pieces holding null', 'a.grid.pieces[1]', (s) => ((gridA(s).pieces as unknown[])[1] = null)],
    ['a piece id a number', 'a.grid.pieces[0].id', (s) => (((gridA(s).pieces as Rec[])[0] as Rec).id = 7)],
    ['grid width a string', 'a.grid.width', (s) => (gridA(s).width = '4')],
    ['autopilot null', 'a.autopilot', (s) => (sideA(s).autopilot = null)],
    ['autopilot deck not an object', 'a.autopilot.deck', (s) => (sideA(s).autopilot = { deck: 3, temperature: 2 })],
    ['autopilot deck card holding null', 'a.autopilot.deck.cards[0]', (s) => (sideA(s).autopilot = { deck: { cards: [null] }, temperature: 2 })],
    ['autopilot temperature a string', 'a.autopilot.temperature', (s) => (sideA(s).autopilot = { deck: {}, temperature: '2' })],
    ['opponentId a number', 'a.opponentId', (s) => (sideA(s).opponentId = 2)],
  ])('%s → shape at %s', (_name, path, edit) => {
    const s = good();
    edit(s);
    expect(shapePaths(s)).toContain(path);
  });

  it('reports every shape problem, side A then side B', () => {
    const s = good();
    act0(s).level = 'high';
    (s.b as Rec).bench = null;
    expect(shapePaths(s)).toEqual(['a.active[0].level', 'b.bench']);
  });

  it('a well-shaped setup with bad values still gets the value codes, not shape', () => {
    const s = structuredClone(gridlessSetup({ active: [mon('a-act1', 'missingno')] }));
    expect(validateSetup(s).errors.map((e) => e.code)).toEqual(['unknownId']);
  });

  it('never throws on arbitrary input', () => {
    const any = fc.anything({ withNullPrototype: true, withSparseArray: true, withBoxedValues: true, withMap: true, withSet: true, withBigInt: true, withDate: true, withTypedArray: true, withObjectString: true });
    fc.assert(
      fc.property(any, (v) => {
        expect(validateSetup(v).ok).toBe(false);
      }),
      { numRuns: 500 },
    );
  });

  it('never throws on a legal setup with one field replaced by arbitrary data', () => {
    const paths: string[][] = [['a'], ['kind'], ['a', 'orchestrator'], ['a', 'active'], ['b', 'bench'], ['a', 'grid'], ['a', 'autopilot'], ['a', 'opponentId'], ['a', 'orchestrator', 'level'], ['a', 'orchestrator', 'moves'], ['b', 'active', '0'], ['b', 'active', '0', 'recordedFoes'], ['a', 'grid', 'pieces'], ['a', 'grid', 'pieces', '1'], ['a', 'grid', 'pieces', '1', 'subagentId'], ['a', 'grid', 'height']];
    const any = fc.anything({ withNullPrototype: true, withSparseArray: true, withBoxedValues: true, withBigInt: true });
    fc.assert(
      fc.property(fc.constantFrom(...paths), any, (path, v) => {
        const s = good();
        let at: Rec = s;
        for (const k of path.slice(0, -1)) at = at[k] as Rec;
        at[path[path.length - 1] as string] = v;
        expect(() => validateSetup(s)).not.toThrow();
      }),
      { numRuns: 500 },
    );
  });
});

