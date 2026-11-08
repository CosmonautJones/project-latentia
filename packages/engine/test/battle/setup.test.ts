import type { Deck } from '../../src/cards/model.js';
import { describe, expect, it } from 'vitest';
import { SPECIES } from '../../src/content/species.js';
import { canonicalJson } from '../../src/events/canonical.js';
import type { PlacedPiece } from '../../src/grid/model.js';
import { EngineInvariantError } from '../../src/math/bp.js';
import { hpAt, statAt } from '../../src/math/stats.js';
import { parseSeed } from '../../src/rng/seed.js';
import { seedRng } from '../../src/rng/sfc32.js';
import { assertInvariants } from '../../src/battle/invariants.js';
import { createBattle, SetupError, UNIVERSAL_MOVES, validateSetup } from '../../src/battle/setup.js';
import type { BattleSetup, CreatureSetup, SideSetup } from '../../src/battle/setup.js';
import type { BattleState } from '../../src/battle/state.js';
import { grid, piece } from '../grid/helpers.js';

const SEED = '0123456789abcdef0123456789abcdef';
const UNIVERSALS = ['compact', 'clear', 'guardrail'];

const mon = (id: string, species: string, level = 5, moves?: string[]): CreatureSetup => ({
  id,
  species,
  level,
  version: 'v1',
  moves: moves ?? [...(SPECIES[species as keyof typeof SPECIES]?.moves ?? [])],
});
/** A gridded orchestrator lists no moves: they come from its grid. */
const orch = (tag: string, level = 5): CreatureSetup => mon(`${tag}-orch`, 'sagelet', level, []);

const slot = (id: string, x: number, y: number, subagentId?: string): PlacedPiece =>
  subagentId === undefined ? piece(id, 'subagentSlot', x, y) : { ...piece(id, 'subagentSlot', x, y), subagentId };
const skill = (id: string, x: number, y: number, moveId: string): PlacedPiece => ({ ...piece(id, 'skill', x, y), moveId });
const graft = (id: string, x: number, y: number, moveId: string): PlacedPiece => ({
  id, kind: 'graft', shape: [[0, 0], [1, 0], [2, 0]], anchor: [x, y], rotation: 0, moveId,
});

/**
 * 5x4 (L4-L6) layout: System Prompt 3 + Skill 2 + two Slots 8 + Tool 1 + Example Card 1 = 15 cells,
 * headroom 5 (the whole bottom row). The slots hold `${tag}-act1` and `${tag}-act2`.
 */
const l5Grid = (tag: string) =>
  grid(5, 4, [
    piece('sp', 'systemPrompt', 0, 0),
    skill('sk', 3, 0, 'chain-of-thought'),
    slot('slot1', 0, 1, `${tag}-act1`),
    slot('slot2', 2, 1, `${tag}-act2`),
    piece('tl', 'tool', 4, 1),
    piece('ex', 'exampleCard', 4, 2),
  ]);

/** 6x5 (L10-L12) layout with room for extra pieces in rows 3-4. */
const l10Grid = (tag: string, extra: PlacedPiece[] = [], slots = [slot('slot1', 0, 1, `${tag}-act1`), slot('slot2', 2, 1, `${tag}-act2`)]) =>
  grid(6, 5, [piece('sp', 'systemPrompt', 0, 0), ...slots, ...extra]);

const side = (tag: string, over: Partial<SideSetup> = {}): SideSetup => ({
  orchestrator: orch(tag),
  active: [mon(`${tag}-act1`, 'blitzr'), mon(`${tag}-act2`, 'forkling')],
  bench: [mon(`${tag}-b1`, 'tokenibble'), mon(`${tag}-b2`, 'agentoad'), mon(`${tag}-b3`, 'blitzr')],
  grid: l5Grid(tag),
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
    const state = createBattle(
      setupOf({ active: [mon('a-act1', 'blitzr')], bench: [], grid: null }, { bench: [mon('b-b1', 'tokenibble')] }),
      SEED,
    );
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
      { active: [mon('x1', 'blitzr'), mon('x2', 'blitzr'), mon('x3', 'blitzr')], grid: null },
      { bench: [mon('y1', 'blitzr'), mon('y2', 'blitzr'), mon('y3', 'blitzr'), mon('y4', 'blitzr')] },
    );
    expect(codes(s)).toEqual([
      ['activeCount', 'a.active[2]'],
      ['benchCount', 'b.bench[3]'],
    ]);
  });

  it('rejects an unknown species or move with unknownId', () => {
    const s = setupOf({ active: [mon('a-act1', 'notamon', 5, []), mon('a-act2', 'blitzr', 5, ['ship-it', 'no-such-move'])] });
    expect(codes(s)).toEqual([
      ['unknownId', 'a.active[0].species'],
      ['unknownId', 'a.active[1].moves[1]'],
    ]);
  });

  it('treats prototype keys as unknown ids', () => {
    const s = setupOf({ active: [mon('a-act1', 'constructor', 5, ['toString']), mon('a-act2', 'forkling')] });
    expect(codes(s)).toEqual([
      ['unknownId', 'a.active[0].species'],
      ['unknownId', 'a.active[0].moves[0]'],
    ]);
  });

  it('rejects a move the species does not know with moveNotKnown, including the Directive lever', () => {
    // hard-fork is Forkling's signature; directive is an orchestrator command lever, never a listed move.
    const s = setupOf({ bench: [mon('a-b1', 'blitzr', 5, ['ship-it', 'hard-fork', 'directive'])] });
    expect(codes(s)).toEqual([
      ['moveNotKnown', 'a.bench[0].moves[1]'],
      ['moveNotKnown', 'a.bench[0].moves[2]'],
    ]);
  });

  it('rejects a listed universal move with universalListed', () => {
    const s = setupOf({ bench: [mon('a-b1', 'blitzr', 5, ['ship-it', 'compact', 'clear', 'guardrail'])] });
    expect(codes(s)).toEqual([
      ['universalListed', 'a.bench[0].moves[1]'],
      ['universalListed', 'a.bench[0].moves[2]'],
      ['universalListed', 'a.bench[0].moves[3]'],
    ]);
  });

  it('rejects a duplicate move id with duplicateMove', () => {
    const s = setupOf({ bench: [mon('a-b1', 'blitzr', 5, ['ship-it', 'token-burst', 'ship-it'])] });
    expect(codes(s)).toEqual([['duplicateMove', 'a.bench[0].moves[2]']]);
  });

  it('rejects more than 4 non-universal moves for a subagent with moveCount', () => {
    const s = setupOf({ bench: [mon('a-b1', 'blitzr', 5, ['ship-it', 'token-burst', 'low-latency', 'distilled-strike', 'hard-fork'])] });
    expect(codes(s)).toEqual([
      ['moveNotKnown', 'a.bench[0].moves[4]'],
      ['moveCount', 'a.bench[0].moves'],
    ]);
  });

  it('rejects levels outside 1..100 or non-integers with level', () => {
    const s = setupOf(
      { orchestrator: mon('a-orch', 'sagelet', 0, []), active: [], grid: null },
      { bench: [mon('x', 'blitzr', 101), mon('y', 'blitzr', 2.5)] },
    );
    expect(codes(s)).toEqual([
      ['level', 'a.orchestrator.level'],
      ['level', 'b.bench[0].level'],
      ['level', 'b.bench[1].level'],
    ]);
  });

  it('rejects an unknown version', () => {
    const bad = { ...mon('x', 'blitzr'), version: 'v9' } as unknown as CreatureSetup;
    expect(codes(setupOf({ bench: [bad] }))).toEqual([['version', 'a.bench[0].version']]);
  });

  it('rejects duplicate creature ids across both sides with duplicateId', () => {
    const s = setupOf({}, { bench: [mon('a-orch', 'tokenibble'), mon('b-b2', 'blitzr'), mon('b-b2', 'blitzr')] });
    expect(codes(s)).toEqual([
      ['duplicateId', 'b.bench[0].id'],
      ['duplicateId', 'b.bench[2].id'],
    ]);
  });

  it('rejects generalization outside integer 0..100 and temperatures outside integer 0..4 with range', () => {
    const g = (generalization: number): CreatureSetup => ({ ...mon(`g${generalization}`, 'blitzr'), generalization });
    const t = { ...mon('t', 'blitzr'), trainedTemperature: 5 } as unknown as CreatureSetup;
    const ok = { ...mon('ok', 'blitzr'), generalization: 0, trainedTemperature: 4 } as CreatureSetup;
    const deck = {} as never;
    const s = setupOf(
      { bench: [g(101), g(-1), g(2.5)] },
      { bench: [t, ok], autopilot: { deck, temperature: 7 as never } },
    );
    expect(codes(s)).toEqual([
      ['range', 'a.bench[0].generalization'],
      ['range', 'a.bench[1].generalization'],
      ['range', 'a.bench[2].generalization'],
      ['range', 'b.bench[0].trainedTemperature'],
      ['range', 'b.autopilot.temperature'],
    ]);
  });

  it('surfaces grid errors with the a.grid / b.grid path prefix, validated at the orchestrator level', () => {
    const twoPrompts = grid(5, 4, [piece('sp', 'systemPrompt', 0, 0), piece('sp2', 'systemPrompt', 0, 1)]);
    const offGrid = grid(5, 4, [piece('sp', 'systemPrompt', 0, 0), piece('tl', 'tool', 9, 9)]);
    expect(codes(setupOf({ grid: twoPrompts, active: [] }, { grid: offGrid, active: [] }))).toEqual([
      ['systemPromptCount', 'a.grid.pieces'],
      ['bounds', 'b.grid.pieces[1]'],
    ]);
    // A level-7 orchestrator needs a 5x5 grid.
    expect(codes(setupOf({ orchestrator: orch('a', 7) }))).toEqual([['gridSize', 'a.grid.width']]);
  });

  it('returns every error at once', () => {
    const s = setupOf(
      { active: [mon('a-act1', 'nope', 0, []), mon('a-act2', 'blitzr'), mon('a-act3', 'blitzr')], grid: null },
      { grid: grid(5, 4, []), active: [] },
    );
    expect(codes(s)).toEqual([
      ['unknownId', 'a.active[0].species'],
      ['level', 'a.active[0].level'],
      ['activeCount', 'a.active[2]'],
      ['systemPromptCount', 'b.grid.pieces'],
    ]);
  });
});

describe('slot binding', () => {
  it('rejects an active subagent with no matching Subagent Slot piece', () => {
    const g = l10Grid('a', [], [slot('slot1', 0, 1, 'a-act1'), slot('slot2', 2, 1)]);
    expect(codes(setupOf({ orchestrator: orch('a', 10), grid: g }))).toEqual([['slotBinding', 'a.active[1]']]);
  });

  it('rejects two pieces naming the same subagent', () => {
    const g = l10Grid('a', [], [slot('slot1', 0, 1, 'a-act1'), slot('slot2', 2, 1, 'a-act2'), slot('slot3', 0, 3, 'a-act1')]);
    expect(codes(setupOf({ orchestrator: orch('a', 10), grid: g }))).toEqual([
      ['slotBinding', 'a.grid.pieces[3]'],
      ['slotBinding', 'a.grid.pieces'],
    ]);
  });

  it('rejects a slot piece naming an id that is not an active creature on that side', () => {
    const bench = l10Grid('a', [], [slot('slot1', 0, 1, 'a-act1'), slot('slot2', 2, 1, 'a-b1')]);
    expect(codes(setupOf({ orchestrator: orch('a', 10), active: [mon('a-act1', 'blitzr')], grid: bench }))).toEqual([
      ['slotBinding', 'a.grid.pieces[2]'],
    ]);
    const foe = l10Grid('a', [], [slot('slot1', 0, 1, 'a-act1'), slot('slot2', 2, 1, 'b-act1')]);
    expect(codes(setupOf({ orchestrator: orch('a', 10), active: [mon('a-act1', 'blitzr')], grid: foe }))).toEqual([
      ['slotBinding', 'a.grid.pieces[2]'],
    ]);
  });

  it('rejects more actives than slot pieces', () => {
    const g = l10Grid('a', [], [slot('slot1', 0, 1, 'a-act1')]);
    expect(codes(setupOf({ orchestrator: orch('a', 10), grid: g }))).toEqual([
      ['slotBinding', 'a.active[1]'],
      ['slotBinding', 'a.active'],
    ]);
  });

  it('binds each active to its slot piece on a gridded side', () => {
    const state = createBattle(setupOf(), SEED);
    expect(state.sides.a.slots).toEqual([
      { pieceId: 'slot1', occupant: 1 },
      { pieceId: 'slot2', occupant: 2 },
    ]);
    expect(state.sides.b.slots).toEqual([
      { pieceId: 'slot1', occupant: 7 },
      { pieceId: 'slot2', occupant: 8 },
    ]);
  });

  it('binds by subagentId, not piece order, and keeps an unnamed slot piece empty', () => {
    const swapped = l10Grid('a', [], [slot('slotX', 0, 1, 'a-act2'), slot('slotY', 2, 1, 'a-act1')]);
    const s1 = createBattle(setupOf({ orchestrator: orch('a', 10), grid: swapped }), SEED);
    expect(s1.sides.a.slots).toEqual([
      { pieceId: 'slotY', occupant: 1 },
      { pieceId: 'slotX', occupant: 2 },
    ]);
    const oneEmpty = l10Grid('a', [], [slot('slotX', 0, 1), slot('slotY', 2, 1, 'a-act1')]);
    const s2 = createBattle(setupOf({ orchestrator: orch('a', 10), active: [mon('a-act1', 'blitzr')], grid: oneEmpty }), SEED);
    expect(s2.sides.a.slots).toEqual([
      { pieceId: 'slotY', occupant: 1 },
      { pieceId: 'slotX', occupant: null },
    ]);
  });

  it('has pieceId null on a gridless side and on a gridded side lacking a second slot piece', () => {
    const gridless = createBattle(setupOf({ active: [mon('a-act1', 'blitzr')], grid: null }), SEED);
    expect(gridless.sides.a.slots).toEqual([
      { pieceId: null, occupant: 1 },
      { pieceId: null, occupant: null },
    ]);
    const oneSlot = l10Grid('a', [], [slot('slot1', 0, 1)]);
    const s = createBattle(setupOf({ orchestrator: orch('a', 10), active: [], grid: oneSlot }), SEED);
    expect(s.sides.a.slots).toEqual([
      { pieceId: 'slot1', occupant: null },
      { pieceId: null, occupant: null },
    ]);
  });
});

describe('moves', () => {
  it('stores listed moves then the universals compact, /clear, guardrail', () => {
    expect(UNIVERSAL_MOVES).toEqual(UNIVERSALS);
    const state = createBattle(setupOf(), SEED);
    expect(state.creatures[1]?.moves).toEqual([...SPECIES.blitzr.moves, ...UNIVERSALS]);
  });

  it('derives a gridded orchestrator moveset: signature, then Skill and graft moveIds in pieces order', () => {
    const g = l10Grid('a', [skill('sk1', 0, 3, 'step-back-prompt'), graft('gf', 0, 4, 'ship-it'), skill('sk2', 2, 3, 'chain-of-thought')]);
    const state = createBattle(setupOf({ orchestrator: orch('a', 10), grid: g }), SEED);
    expect(state.creatures[0]?.moves).toEqual(['happy-to-help', 'step-back-prompt', 'ship-it', 'chain-of-thought', ...UNIVERSALS]);
  });

  it('rejects listed moves on a gridded orchestrator with movesFromGrid', () => {
    expect(codes(setupOf({ orchestrator: mon('a-orch', 'sagelet', 5) }))).toEqual([['movesFromGrid', 'a.orchestrator.moves']]);
  });

  it('rejects a Skill the orchestrator species does not know, or a graft that is not a signature, with moveNotKnown', () => {
    const g = l10Grid('a', [skill('sk1', 0, 3, 'token-burst'), graft('gf', 0, 4, 'chain-of-thought')]);
    expect(codes(setupOf({ orchestrator: orch('a', 10), grid: g }))).toEqual([
      ['moveNotKnown', 'a.grid.pieces[3].moveId'],
      ['moveNotKnown', 'a.grid.pieces[4].moveId'],
    ]);
  });

  it('checks grid moveIds for unknown ids, universals, duplicates and absence', () => {
    const noMove: PlacedPiece = piece('sk4', 'skill', 4, 4);
    const g = l10Grid('a', [
      skill('sk1', 0, 3, 'no-such-move'),
      skill('sk2', 2, 3, 'happy-to-help'),
      skill('sk3', 4, 3, 'guardrail'),
      noMove,
    ]);
    expect(codes(setupOf({ orchestrator: orch('a', 10), grid: g }))).toEqual([
      ['unknownId', 'a.grid.pieces[3].moveId'],
      ['duplicateMove', 'a.grid.pieces[4].moveId'],
      ['universalListed', 'a.grid.pieces[5].moveId'],
      ['moveNotKnown', 'a.grid.pieces[6].moveId'],
    ]);
  });

  it('keeps listed moves for a gridless orchestrator', () => {
    const state = createBattle(setupOf({ orchestrator: mon('a-orch', 'sagelet', 5, ['proof-by-contradiction']), grid: null }), SEED);
    expect(state.creatures[0]?.moves).toEqual(['proof-by-contradiction', ...UNIVERSALS]);
  });
});

describe('createBattle', () => {
  it('throws SetupError carrying every validation error', () => {
    const s = setupOf({ active: [mon('a-act1', 'blitzr'), mon('a-act2', 'blitzr'), mon('a-act3', 'nope', 5, [])], grid: null });
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

  it('starts at round 0 with the seed, the seeded rng, no fields, not ended, result null', () => {
    const state = createBattle(setupOf(), SEED);
    const parsed = parseSeed(SEED);
    if (!parsed.ok) throw new Error('fixture seed must parse');
    expect(state.round).toBe(0);
    expect(state.seed).toBe(SEED);
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
    const state = createBattle(setupOf({ active: [withExtras, mon('a-act2', 'forkling')] }), SEED);
    const plain = state.creatures[0];
    const extra = state.creatures[1];
    expect(plain).toMatchObject({
      speciesId: 'sagelet',
      level: 5,
      version: 'v1',
      moves: ['happy-to-help', 'chain-of-thought', ...UNIVERSALS],
      statuses: [],
      stages: { compute: 0, robustness: 0, latency: 0, accuracy: 0, evasion: 0 },
      guardStreak: 0,
      guard: null,
      leftFieldRound: null,
      fainted: false,
      deck: null,
      generalization: null,
      trainedTemperature: null,
      recordedFoes: null,
      charging: null,
      nextActionMods: [],
      shields: [{ against: 'status', count: 1 }], // Sagelet's Disclaimer, a battleStart passive
      snapshots: [],
      passivesUsed: [],
      actedThisBattle: false,
      lastMoveId: null,
    });
    // Blitzr's Move Fast queues +1 priority for its first Sort.
    expect(extra).toMatchObject({ generalization: 72, trainedTemperature: 3, recordedFoes: ['b-act1'], nextActionMods: [{ kind: 'priority', delta: 1 }], shields: [] });
  });

  it('builds side state: grid copy, default temperature T2 or the Autopilot temperature, not headless, no policy or directive', () => {
    const deck = { cards: [] } as never;
    const state = createBattle(setupOf({}, { autopilot: { deck, temperature: 4 } }), SEED);
    expect(state.sides.a).toEqual({
      grid: l5Grid('a'),
      temperature: 2,
      autopilot: null,
      opponentId: 'b',
      headless: false,
      slots: [
        { pieceId: 'slot1', occupant: 1 },
        { pieceId: 'slot2', occupant: 2 },
      ],
      lastMove: null,
      policies: [],
      directive: null,
    });
    expect(state.fields).toEqual([]);
    expect(state.turnOrder).toEqual([]);
    expect(state.sides.b.temperature).toBe(4);
    expect(state.sides.b.autopilot).toEqual({ deck: { cards: [] }, temperature: 4 });
  });

  it('never aliases the caller setup', () => {
    const s = setupOf();
    const before = structuredClone(s);
    const state = createBattle(s, SEED);
    (state.sides.a.grid?.pieces as unknown[]).pop();
    state.creatures[1]?.moves.push('x');
    state.creatures[0]?.moves.push('x');
    expect(s).toEqual(before);
  });

  it('is plain data: survives canonicalJson and deep-equals its structuredClone', () => {
    const deck: Deck = { cards: [], default: { id: 'default', subject: 'self', condition: { category: 'coin' }, move: 'ship-it', target: 'lowestHpFoe' } };
    const state = createBattle(setupOf({ active: [{ ...mon('a-act1', 'blitzr'), deck }, mon('a-act2', 'forkling')] }, { grid: null }), SEED);
    expect(() => canonicalJson(state)).not.toThrow();
    expect(structuredClone(state)).toStrictEqual(state);
    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
  });
});

describe('assertInvariants', () => {
  const fresh = (): BattleState => createBattle(setupOf(), SEED);
  const at = (s: BattleState, i: number) => {
    const c = s.creatures[i];
    if (c === undefined) throw new Error(`fixture has no creature ${i}`);
    return c;
  };
  const expectViolation = (state: BattleState, actor: number | undefined) => {
    let caught: unknown;
    try {
      assertInvariants(state);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EngineInvariantError);
    expect((caught as EngineInvariantError).actor).toBe(actor);
    expect((caught as EngineInvariantError).round).toBe(state.round);
    expect((caught as EngineInvariantError).seed).toBe(SEED);
  };

  it('passes on a fresh battle', () => {
    expect(() => assertInvariants(fresh())).not.toThrow();
  });

  it('rejects a Directive kept past its round and a Policy Update no longer in force', () => {
    const s = fresh();
    s.sides.a.directive = { subagent: 1, moveId: 'ship-it', target: 7, round: 0 };
    expectViolation(s, undefined); // a side's fault: no creature to blame
    const card = { id: 'p', subject: 'self', condition: { category: 'coin' }, move: 'compact', target: 'self' } as const;
    const t = fresh();
    t.round = 3;
    t.sides.b.policies = [{ card, fromRound: 2, lastRound: 4 }];
    expect(() => assertInvariants(t)).not.toThrow();
    t.sides.b.policies = [{ card, fromRound: 1, lastRound: 3 }];
    expectViolation(t, undefined);
  });

  it('rejects HP above max or below 0', () => {
    const s = fresh();
    at(s, 2).hp = at(s, 2).maxHp + 1;
    expectViolation(s, 2);
    const t = fresh();
    at(t, 7).hp = -1;
    expectViolation(t, 7);
  });

  it('rejects fainted without 0 HP, and 0 HP without fainted', () => {
    const s = fresh();
    at(s, 3).fainted = true;
    expectViolation(s, 3);
    const t = fresh();
    at(t, 8).hp = 0;
    expectViolation(t, 8);
    const ok = fresh();
    at(ok, 8).hp = 0;
    at(ok, 8).fainted = true;
    expect(() => assertInvariants(ok)).not.toThrow();
  });

  it('rejects tokens beyond the window', () => {
    const s = fresh();
    const c = at(s, 0);
    for (let i = 0; i <= c.context.window; i++) c.context.tokens.push({ kind: 'cost', seq: i });
    expectViolation(s, 0);
  });

  it('rejects Drift outside 0..5', () => {
    const s = fresh();
    at(s, 4).context.drift = 6;
    expectViolation(s, 4);
  });

  it('rejects stages outside -3..3', () => {
    const s = fresh();
    at(s, 9).stages.latency = -4;
    expectViolation(s, 9);
  });

  it('rejects a canonical index that does not match the array position', () => {
    const s = fresh();
    at(s, 5).index = 6;
    expectViolation(s, 5);
  });

  it('rejects a slot that disagrees with activeSlot / benchOrder / isOrchestrator', () => {
    const bench = fresh();
    at(bench, 3).activeSlot = 1;
    expectViolation(bench, 3);
    const active = fresh();
    at(active, 1).benchOrder = 0;
    expectViolation(active, 1);
    const activeNoSlot = fresh();
    at(activeNoSlot, 2).activeSlot = null;
    expectViolation(activeNoSlot, 2);
    const flag = fresh();
    at(flag, 1).isOrchestrator = true;
    expectViolation(flag, 1);
  });

  it('rejects a side without exactly one orchestrator', () => {
    const s = fresh();
    Object.assign(at(s, 9), { slot: 'orchestrator', benchOrder: null, isOrchestrator: true });
    expectViolation(s, 9);
  });

  it('rejects an activeSlot used twice on one side', () => {
    const s = fresh();
    Object.assign(at(s, 3), { slot: 'active', activeSlot: 0, benchOrder: null });
    expectViolation(s, 3);
  });

  it('rejects a slot occupant that does not match the creature in that activeSlot', () => {
    const s = fresh();
    const slot0 = s.sides.a.slots[0];
    if (slot0) slot0.occupant = 2;
    expectViolation(s, 1);
    const t = fresh();
    const slot1 = t.sides.b.slots[1];
    if (slot1) slot1.occupant = null;
    expectViolation(t, 8);
    // An occupant set on a slot no creature holds.
    const u = createBattle(setupOf({ active: [mon('a-act1', 'blitzr')], grid: null }), SEED);
    const empty = u.sides.a.slots[1];
    if (empty) empty.occupant = 3;
    expectViolation(u, 3);
  });
});
