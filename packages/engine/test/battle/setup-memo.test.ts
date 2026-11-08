import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { knownValidSetup, rememberValidSetup } from '../../src/battle/setup-memo.js';
import { createBattle, SetupError, validateSetup, type BattleSetup } from '../../src/battle/setup.js';
import { arbLegalSetup, seedAt } from '../helpers/arbitraries.js';
import { SCENARIOS } from '../golden/scenarios.js';

// The validated-setup memo (C3.5) lets createBattle skip validateSetup for a setup object it validated before and
// that has not changed since. It must never let an edited setup through: after any edit, createBattle answers exactly
// what a fresh validateSetup says.

type Path = (string | number)[];

/** Every path from the root to a value inside `v` (objects by own enumerable key, arrays by index). */
function pathsOf(v: unknown, at: Path = []): Path[] {
  if (typeof v !== 'object' || v === null) return [];
  const keys: (string | number)[] = Array.isArray(v) ? v.map((_, i) => i) : Object.keys(v);
  return keys.flatMap((k) => [[...at, k], ...pathsOf((v as Record<string | number, unknown>)[k], [...at, k])]);
}

function parentOf(root: unknown, path: Path): Record<string | number, unknown> {
  let node = root as Record<string | number, unknown>;
  for (const k of path.slice(0, -1)) node = node[k] as Record<string | number, unknown>;
  return node;
}

const EDITS = ['set 0', 'set -1', 'set 101', 'set "zz"', 'set null', 'set undefined', 'set []', 'set {}', 'delete', 'push', 'hide'] as const;
type Edit = (typeof EDITS)[number];

/** Applies `edit` at `path` in place; `hide` keeps the value but makes the property non-enumerable. */
function applyEdit(root: unknown, path: Path, edit: Edit): void {
  const parent = parentOf(root, path);
  const key = path.at(-1) as string | number;
  const values: Record<string, unknown> = { 'set 0': 0, 'set -1': -1, 'set 101': 101, 'set "zz"': 'zz', 'set null': null, 'set undefined': undefined, 'set []': [], 'set {}': {} };
  if (edit === 'delete') {
    if (Array.isArray(parent)) parent.splice(key as number, 1);
    else delete parent[key];
  } else if (edit === 'push') {
    const v = parent[key];
    if (Array.isArray(v)) v.push(structuredClone(v[0] ?? 'zz'));
    else parent[key] = [v];
  } else if (edit === 'hide') {
    Object.defineProperty(parent, key, { value: parent[key], enumerable: false, configurable: true, writable: true });
  } else {
    parent[key] = values[edit];
  }
}

/** createBattle's answer: null when it builds, else its SetupError's errors. */
function outcome(setup: BattleSetup): unknown[] | null {
  try {
    createBattle(setup, seedAt(0));
    return null;
  } catch (e) {
    if (e instanceof SetupError) return e.errors;
    throw e;
  }
}

/** A copy of `xs` with a hole before its elements. */
function holed<T>(xs: readonly T[]): T[] {
  const out = new Array<T>(xs.length + 1);
  xs.forEach((x, i) => (out[i + 1] = x));
  return out;
}

describe('validated-setup memo (C3.5)', () => {
  it('after any edits to a setup that passed, createBattle answers what a fresh validateSetup says', () => {
    const step = fc.tuple(fc.nat(), fc.constantFrom(...EDITS));
    fc.assert(
      fc.property(arbLegalSetup, fc.array(step, { minLength: 1, maxLength: 3 }), (setup, edits) => {
        const own = structuredClone(setup);
        expect(outcome(own)).toBeNull();
        expect(knownValidSetup(own)).toBe(true);
        for (const [at, edit] of edits) {
          const paths = pathsOf(own);
          if (paths.length === 0) return;
          applyEdit(own, paths[at % paths.length] as Path, edit);
          // each edit, then createBattle (which may remember the edited setup), then the next edit
          const fresh = validateSetup(own);
          expect(outcome(own)).toEqual(fresh.ok ? null : fresh.errors);
        }
      }),
      { numRuns: 400 },
    );
  });

  it('a property made non-enumerable is still watched: hide, pass, then edit it', () => {
    const setup = structuredClone(SCENARIOS[0]?.setup) as BattleSetup;
    applyEdit(setup, ['a', 'orchestrator', 'level'], 'hide');
    const hidden = validateSetup(setup);
    expect(outcome(setup)).toEqual(hidden.ok ? null : hidden.errors);
    setup.a.orchestrator.level = 0;
    const fresh = validateSetup(setup);
    expect(fresh.ok).toBe(false);
    expect(outcome(setup)).toEqual(fresh.errors);
  });

  it('an edit that is undone validates as before; a reordered key is a change', () => {
    const setup = structuredClone(SCENARIOS[0]?.setup) as BattleSetup;
    expect(outcome(setup)).toBeNull();
    const level = setup.a.orchestrator.level;
    setup.a.orchestrator.level = 0;
    expect(outcome(setup)).toEqual(validateSetup(setup).errors);
    expect(knownValidSetup(setup)).toBe(false);
    setup.a.orchestrator.level = level;
    expect(outcome(setup)).toBeNull();
    expect(knownValidSetup(setup)).toBe(true);
    const { a } = setup;
    delete (setup as Partial<BattleSetup>).a;
    setup.a = a; // now after b and kind
    expect(knownValidSetup(setup)).toBe(false);
  });

  it('remembers only strictly plain data', () => {
    const plain = structuredClone(SCENARIOS[0]?.setup) as BattleSetup;
    rememberValidSetup(plain);
    expect(knownValidSetup(plain)).toBe(true);
    const odd: unknown[] = [
      Object.assign(Object.create(null) as object, plain),
      { ...plain, a: Object.assign(Object.create(null) as object, plain.a) },
      { ...plain, a: { ...plain.a, active: Object.assign([...plain.a.active], { extra: 1 }) } },
      { ...plain, a: { ...plain.a, bench: holed(plain.a.bench) } },
      { ...plain, tag: new Map() },
      { ...plain, tag: () => 1 },
    ];
    for (const o of odd) {
      rememberValidSetup(o);
      expect(knownValidSetup(o)).toBe(false);
    }
    expect(knownValidSetup(null)).toBe(false);
    expect(knownValidSetup(structuredClone(plain))).toBe(false); // per object: an equal copy was never validated
  });
});
