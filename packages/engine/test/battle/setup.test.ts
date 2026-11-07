import { describe, expect, it } from 'vitest';
import { SPECIES } from '../../src/content/species.js';
import { canonicalJson } from '../../src/events/canonical.js';
import { EngineInvariantError } from '../../src/math/bp.js';
import { hpAt, statAt } from '../../src/math/stats.js';
import { parseSeed } from '../../src/rng/seed.js';
import { seedRng } from '../../src/rng/sfc32.js';
import { assertInvariants } from '../../src/battle/invariants.js';
import { createBattle, SetupError, validateSetup } from '../../src/battle/setup.js';
import type { BattleSetup, CreatureSetup, SideSetup } from '../../src/battle/setup.js';
import type { BattleState } from '../../src/battle/state.js';
import { grid, piece } from '../grid/helpers.js';

const SEED = '0123456789abcdef0123456789abcdef';

const mon = (id: string, species: string, level = 5, moves?: string[]): CreatureSetup => ({
  id,
  species,
  level,
  version: 'v1',
  moves: moves ?? [...(SPECIES[species as keyof typeof SPECIES]?.moves ?? [])],
});

/** 4x4 L1-L3 layout: System Prompt 3 + Skill 2 + Tool 1 + Slot 4 + Example Card 1 = 11 cells, headroom 5. */
const l1Grid = () =>
  grid(4, 4, [
    piece('sp', 'systemPrompt', 0, 0),
    piece('sk', 'skill', 0, 1),
    piece('tl', 'tool', 2, 1),
    piece('slot', 'subagentSlot', 0, 2),
    piece('ex', 'exampleCard', 2, 2),
  ]);

const side = (tag: string, over: Partial<SideSetup> = {}): SideSetup => ({
  orchestrator: mon(`${tag}-orch`, 'sagelet', 3),
  active: [mon(`${tag}-act1`, 'blitzr'), mon(`${tag}-act2`, 'forkling')],
  bench: [mon(`${tag}-b1`, 'tokenibble'), mon(`${tag}-b2`, 'agentoad'), mon(`${tag}-b3`, 'blitzr')],
  grid: l1Grid(),
  opponentId: tag === 'a' ? 'b' : 'a',
  ...over,
});

const setupOf = (a: Partial<SideSetup> = {}, b: Partial<SideSetup> = {}): BattleSetup => ({
  a: side('a', a),
  b: side('b', b),
  kind: 'trainer',
});

const codes = (s: BattleSetup) => validateSetup(s).errors.map((e) => [e.code, e.path]);

describe('canonical order', () => {
  it('is A orchestrator, A active 1-2, A bench 1-3, then B in the same order', () => {
    const state = createBattle(setupOf(), SEED);
    expect(state.creatures.map((c) => c.id)).toEqual([
      'a-orch', 'a-act1', 'a-act2', 'a-b1', 'a-b2', 'a-b3',
      'b-orch', 'b-act1', 'b-act2', 'b-b1', 'b-b2', 'b-b3',
    ]);
    state.creatures.forEach((c, i) => expect(c.index).toBe(i));
    expect(state.creatures.map((c) => [c.side, c.slot, c.activeSlot, c.benchOrder])).toEqual([
      ['a', 'orchestrator', null, null],
      ['a', 'active', 0, null],
      ['a', 'active', 1, null],
      ['a', 'bench', null, 0],
      ['a', 'bench', null, 1],
      ['a', 'bench', null, 2],
      ['b', 'orchestrator', null, null],
      ['b', 'active', 0, null],
      ['b', 'active', 1, null],
      ['b', 'bench', null, 0],
      ['b', 'bench', null, 1],
      ['b', 'bench', null, 2],
    ]);
    expect(state.creatures.map((c) => c.isOrchestrator)).toEqual([
      true, false, false, false, false, false, true, false, false, false, false, false,
    ]);
  });

  it('assigns indices only to creatures that exist (no gaps)', () => {
    const state = createBattle(setupOf({ active: [mon('a-act1', 'blitzr')], bench: [] }, { bench: [mon('b-b1', 'tokenibble')] }), SEED);
    expect(state.creatures.map((c) => [c.index, c.id])).toEqual([
      [0, 'a-orch'],
      [1, 'a-act1'],
      [2, 'b-orch'],
      [3, 'b-act1'],
      [4, 'b-act2'],
      [5, 'b-b1'],
    ]);
  });
});

describe('validateSetup', () => {
  it('accepts a legal setup, including a side with no subagents and no grid', () => {
    expect(validateSetup(setupOf()).errors).toEqual([]);
    expect(validateSetup(setupOf()).ok).toBe(true);
    expect(validateSetup(setupOf({}, { active: [], bench: [], grid: null })).ok).toBe(true);
  });

  it('rejects 3 active with activeCount and 4 bench with benchCount', () => {
    const s = setupOf(
      { active: [mon('x1', 'blitzr'), mon('x2', 'blitzr'), mon('x3', 'blitzr')] },
      { bench: [mon('y1', 'blitzr'), mon('y2', 'blitzr'), mon('y3', 'blitzr'), mon('y4', 'blitzr')] },
    );
    expect(codes(s)).toEqual([
      ['activeCount', 'a.active[2]'],
      ['benchCount', 'b.bench[3]'],
    ]);
  });

  it('rejects an unknown species or move with unknownId', () => {
    const s = setupOf({ active: [mon('x', 'notamon', 5, []), mon('y', 'blitzr', 5, ['ship-it', 'no-such-move'])] });
    expect(codes(s)).toEqual([
      ['unknownId', 'a.active[0].species'],
      ['unknownId', 'a.active[1].moves[1]'],
    ]);
  });

  it('treats prototype keys as unknown ids', () => {
    const s = setupOf({ active: [mon('x', 'constructor', 5, ['toString'])] });
    expect(codes(s)).toEqual([
      ['unknownId', 'a.active[0].species'],
      ['unknownId', 'a.active[0].moves[0]'],
    ]);
  });

  it('rejects a move the species does not know with moveNotKnown, but allows universal moves', () => {
    // hard-fork is Forkling's signature; compact, clear and guardrail are universal.
    const s = setupOf({ active: [mon('x', 'blitzr', 5, ['ship-it', 'hard-fork', 'compact', 'clear', 'guardrail'])] });
    expect(codes(s)).toEqual([['moveNotKnown', 'a.active[0].moves[1]']]);
  });

  it('rejects levels outside 1..100 or non-integers with level', () => {
    const s = setupOf(
      { orchestrator: mon('o', 'sagelet', 0) },
      { active: [mon('x', 'blitzr', 101), mon('y', 'blitzr', 2.5)] },
    );
    expect(codes(s)).toEqual([
      ['level', 'a.orchestrator.level'],
      ['level', 'b.active[0].level'],
      ['level', 'b.active[1].level'],
    ]);
  });

  it('rejects an unknown version', () => {
    const bad = { ...mon('x', 'blitzr'), version: 'v9' } as unknown as CreatureSetup;
    expect(codes(setupOf({ bench: [bad] }))).toEqual([['version', 'a.bench[0].version']]);
  });

  it('surfaces grid errors with the a.grid / b.grid path prefix, validated at the orchestrator level', () => {
    const twoPrompts = grid(4, 4, [piece('sp', 'systemPrompt', 0, 0), piece('sp2', 'systemPrompt', 0, 1)]);
    const offGrid = grid(4, 4, [piece('sp', 'systemPrompt', 0, 0), piece('tl', 'tool', 9, 9)]);
    expect(codes(setupOf({ grid: twoPrompts }, { grid: offGrid }))).toEqual([
      ['systemPromptCount', 'a.grid.pieces'],
      ['bounds', 'b.grid.pieces[1]'],
    ]);
    // A level-7 orchestrator needs a 5x5 grid.
    expect(codes(setupOf({ orchestrator: mon('o', 'sagelet', 7) }))).toEqual([['gridSize', 'a.grid.width']]);
  });

  it('returns every error at once', () => {
    const s = setupOf(
      { active: [mon('x1', 'nope', 0, []), mon('x2', 'blitzr'), mon('x3', 'blitzr')] },
      { grid: grid(4, 4, []) },
    );
    expect(codes(s)).toEqual([
      ['unknownId', 'a.active[0].species'],
      ['level', 'a.active[0].level'],
      ['activeCount', 'a.active[2]'],
      ['systemPromptCount', 'b.grid.pieces'],
    ]);
  });
});

describe('createBattle', () => {
  it('throws SetupError carrying every validation error', () => {
    const s = setupOf({ active: [mon('x1', 'blitzr'), mon('x2', 'blitzr'), mon('x3', 'nope', 5, [])] });
    let caught: unknown;
    try {
      createBattle(s, SEED);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SetupError);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as SetupError).errors.map((e) => [e.code, e.path])).toEqual([
      ['unknownId', 'a.active[2].species'],
      ['activeCount', 'a.active[2]'],
    ]);
  });

  it.each([
    ['too short', '0123456789abcdef0123456789abcde'],
    ['too long', '0123456789abcdef0123456789abcdef0'],
    ['uppercase', '0123456789ABCDEF0123456789abcdef'],
    ['all zero', '00000000000000000000000000000000'],
  ])('throws SetupError with code seed for an invalid seed (%s)', (_label, seed) => {
    let caught: unknown;
    try {
      createBattle(setupOf(), seed);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SetupError);
    expect((caught as SetupError).errors.map((e) => [e.code, e.path])).toEqual([['seed', 'seed']]);
  });

  it('starts at round 0 with the seeded rng, no fields, not ended, result null', () => {
    const state = createBattle(setupOf(), SEED);
    const parsed = parseSeed(SEED);
    if (!parsed.ok) throw new Error('fixture seed must parse');
    expect(state.round).toBe(0);
    expect(state.rng).toEqual(seedRng(parsed.words));
    expect(state.fields).toEqual([]);
    expect(state.ended).toBe(false);
    expect(state.result).toBeNull();
  });

  it('derives HP from hpAt and raw stats from statAt', () => {
    const state = createBattle(setupOf(), SEED);
    for (const c of state.creatures) {
      const base = SPECIES[c.speciesId as keyof typeof SPECIES].base;
      expect(c.maxHp).toBe(hpAt(base.hp, c.level));
      expect(c.hp).toBe(c.maxHp);
      expect(c.stats).toEqual({
        compute: statAt(base.compute, c.level),
        robustness: statAt(base.robustness, c.level),
        latency: statAt(base.latency, c.level),
      });
    }
    // Spot-check one value: Blitzr L5, base HP 50 -> floor(2*50*5/100) + 5 + 10 = 20.
    expect(state.creatures[1]?.maxHp).toBe(20);
  });

  it('gives the orchestrator its grid headroom as window and subagents their species Ctx', () => {
    const state = createBattle(setupOf({}, { grid: null }), SEED);
    expect(state.creatures[0]?.context.window).toBe(5);
    expect(state.creatures[1]?.context.window).toBe(SPECIES.blitzr.ctx);
    // No grid (e.g. a wild model): the orchestrator falls back to its species Ctx.
    expect(state.creatures[6]?.context.window).toBe(SPECIES.sagelet.ctx);
    expect(state.creatures[0]?.context).toEqual({ window: 5, tokens: [], drift: 0, summarizedPieces: [], removedSlots: [], nextSeq: 0 });
  });

  it('initialises per-creature battle fields and copies optional setup fields as null when absent', () => {
    const withExtras: CreatureSetup = {
      ...mon('a-act1', 'blitzr'),
      generalization: 72,
      trainedTemperature: 3,
      recordedFoes: ['b-act1'],
    };
    const state = createBattle(setupOf({ active: [withExtras] }), SEED);
    const plain = state.creatures[0];
    const extra = state.creatures[1];
    expect(plain).toMatchObject({
      speciesId: 'sagelet',
      level: 3,
      version: 'v1',
      moves: [...SPECIES.sagelet.moves],
      statuses: [],
      stages: { compute: 0, robustness: 0, latency: 0, accuracy: 0, evasion: 0 },
      guardStreak: 0,
      fainted: false,
      deck: null,
      generalization: null,
      trainedTemperature: null,
      recordedFoes: null,
      charging: null,
      nextActionMods: [],
      actedThisBattle: false,
      lastMoveId: null,
    });
    expect(extra).toMatchObject({ generalization: 72, trainedTemperature: 3, recordedFoes: ['b-act1'] });
  });

  it('builds side state: grid copy, default temperature T2 or the Autopilot temperature, not headless', () => {
    const deck = { cards: [] } as never;
    const state = createBattle(setupOf({}, { autopilot: { deck, temperature: 4 } }), SEED);
    expect(state.sides.a).toEqual({
      grid: l1Grid(),
      temperature: 2,
      autopilot: null,
      opponentId: 'b',
      headless: false,
      removedSlots: [],
    });
    expect(state.sides.b.temperature).toBe(4);
    expect(state.sides.b.autopilot).toEqual({ deck: { cards: [] }, temperature: 4 });
  });

  it('never aliases the caller setup', () => {
    const s = setupOf();
    const before = structuredClone(s);
    const state = createBattle(s, SEED);
    (state.sides.a.grid?.pieces as unknown[]).pop();
    state.creatures[1]?.moves.push('compact');
    expect(s).toEqual(before);
  });

  it('is plain data: survives canonicalJson and deep-equals its structuredClone', () => {
    const deck = { cards: [{ id: 'default' }] } as never;
    const state = createBattle(setupOf({ active: [{ ...mon('a-act1', 'blitzr'), deck }] }, { grid: null }), SEED);
    expect(() => canonicalJson(state)).not.toThrow();
    expect(structuredClone(state)).toStrictEqual(state);
    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
  });
});

describe('assertInvariants', () => {
  const fresh = (): BattleState => createBattle(setupOf(), SEED);
  const expectViolation = (state: BattleState, actor: number) => {
    let caught: unknown;
    try {
      assertInvariants(state);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EngineInvariantError);
    expect((caught as EngineInvariantError).actor).toBe(actor);
    expect((caught as EngineInvariantError).round).toBe(state.round);
  };

  it('passes on a fresh battle', () => {
    expect(() => assertInvariants(fresh())).not.toThrow();
  });

  it('rejects HP above max or below 0', () => {
    const s = fresh();
    const c = s.creatures[2];
    if (c) c.hp = c.maxHp + 1;
    expectViolation(s, 2);
    const t = fresh();
    const d = t.creatures[7];
    if (d) d.hp = -1;
    expectViolation(t, 7);
  });

  it('rejects tokens beyond the window', () => {
    const s = fresh();
    const c = s.creatures[0];
    if (c) for (let i = 0; i <= c.context.window; i++) c.context.tokens.push({ kind: 'cost', seq: i });
    expectViolation(s, 0);
  });

  it('rejects Drift outside 0..5', () => {
    const s = fresh();
    const c = s.creatures[4];
    if (c) c.context.drift = 6;
    expectViolation(s, 4);
  });

  it('rejects stages outside -3..3', () => {
    const s = fresh();
    const c = s.creatures[9];
    if (c) c.stages.latency = -4;
    expectViolation(s, 9);
  });

  it('rejects a canonical index that does not match the array position', () => {
    const s = fresh();
    const c = s.creatures[5];
    if (c) c.index = 6;
    expectViolation(s, 5);
  });
});
