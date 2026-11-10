import { describe, expect, expectTypeOf, it } from 'vitest';
import * as engine from '../src/index.js';

describe('public surface (spec §4, so far)', () => {
  it('exports exactly the Phase A values plus getIntents (B2), computeGeneralization and DEPRECATED_FOREST_SUITE (B5), and the catalogs and editor constants (Ruling 119 m3)', () => {
    expect(Object.keys(engine).sort()).toEqual(
      [
        'DEPRECATED_FOREST_SUITE',
        'ENGINE_VERSION',
        'EngineInvariantError',
        'GeneralizationError',
        'SetupError',
        'SimulateError',
        'activeCardCount',
        'computeGeneralization',
        'createBattle',
        'eventStreamHash',
        'fnv1a64Hex',
        'getIntents',
        'replay',
        'simulate',
        'submitRound',
        'validateGrid',
        'validateSetup',
        // content catalogs (m3)
        'LAUNCH_MOVE_IDS',
        'MOVES',
        'SIGNATURE_MOVE_IDS',
        'SPECIES',
        'SPECIES_IDS',
        'STATUSES',
        'STATUS_IDS',
        'TYPES',
        'TYPE_CHART_BP',
        'moveDef',
        'typeMultiplierBp',
        // editor constants and bands (m3)
        'BAND_MIN',
        'CONDITION_CATEGORIES',
        'MAX_AUTOPILOT_CARDS',
        'MAX_DECK_CARDS',
        'TARGET_SELECTORS',
        'bandFor',
        // grid sizes (C2 fix round 1)
        'GRID_SIZE_BY_LEVEL',
        'gridSizeFor',
        // the orchestrator's stored moveset (C4 m1, for the sim's deck search)
        'orchestratorMoves',
      ].sort(),
    );
    expect(engine.ENGINE_VERSION).toBe('0.3.0');
  });

  it('runs and replays a battle through the public surface alone', () => {
    const mon = (id: string, species: string, moves: string[]): engine.CreatureSetup => ({ id, species, level: 5, version: 'v1', moves });
    const side = (tag: string): engine.SideSetup => ({
      orchestrator: mon(`${tag}-o`, 'sagelet', ['happy-to-help']),
      active: [mon(`${tag}-s`, 'blitzr', ['ship-it'])],
      bench: [],
      grid: null,
      opponentId: tag,
    });
    const setup: engine.BattleSetup = { a: side('a'), b: side('b'), kind: 'wild' };
    expect(engine.validateSetup(setup).ok).toBe(true);
    const result: engine.BattleResult = engine.simulate(setup, '0123456789abcdef0123456789abcdef', { kind: 'recorded', rounds: [] });
    const again = engine.replay(result.log);
    expect('error' in again ? again.error : again.hash).toBe(result.hash);
    const bad: { error: engine.ReplayError } | engine.BattleResult = engine.replay({} as engine.BattleLog);
    expect(bad).toEqual({ error: { code: 'malformed' } });
  });

  it('exports the orchestrator’s stored moveset (C4 m1): listed moves, or the signature then grid Skills and grafts', () => {
    const o: engine.CreatureSetup = { id: 'o', species: 'sagelet', level: 8, version: 'v2', moves: [] };
    const piece = (id: string, kind: engine.PieceKind, moveId?: string): engine.PlacedPiece => ({ id, kind, shape: [[0, 0]], anchor: [0, 0], rotation: 0, ...(moveId === undefined ? {} : { moveId }) });
    const grid: engine.GridLayout = { width: 5, height: 5, pieces: [piece('sp', 'systemPrompt'), piece('s1', 'skill', 'chain-of-thought'), piece('t', 'tool'), piece('g', 'graft', 'null-chomp')] };
    const side = (s: Partial<engine.SideSetup>): engine.SideSetup => ({ orchestrator: o, active: [], bench: [], grid: null, opponentId: 'x', ...s });
    expect(engine.orchestratorMoves(side({ grid }))).toEqual(['happy-to-help', 'chain-of-thought', 'null-chomp']);
    expect(engine.orchestratorMoves(side({ orchestrator: { ...o, moves: ['step-back-prompt'] } }))).toEqual(['step-back-prompt']);
  });

  it('computes Generalization from a deck, the Deprecated Forest suite and active slots (B5)', () => {
    const always: engine.Condition = { category: 'turn', op: 'atLeast', round: 1 };
    const deck: engine.Deck = { cards: [], default: { id: 'd', subject: 'self', condition: always, move: 'ship-it', target: 'lowestHpFoe' } };
    const suite: engine.EvalSuite = engine.DEPRECATED_FOREST_SUITE;
    const report: engine.GeneralizationReport = engine.computeGeneralization(deck, suite, 3);
    expect(report).toEqual({ c: [0, 1], r: [0, 1], h: [0, 1], g: 20, band: 'brittle' });
    expect(() => engine.computeGeneralization(deck, suite, 9)).toThrow(engine.GeneralizationError);
  });

  it('exports the content catalogs and editor constants read-only (Ruling 119 m3)', () => {
    const frozen = [
      engine.MOVES,
      engine.MOVES['ship-it'],
      engine.LAUNCH_MOVE_IDS,
      engine.SIGNATURE_MOVE_IDS,
      engine.SPECIES,
      engine.SPECIES.sagelet,
      engine.SPECIES_IDS,
      engine.STATUSES,
      engine.STATUSES.glazed,
      engine.STATUS_IDS,
      engine.TYPES,
      engine.TYPE_CHART_BP,
      engine.TYPE_CHART_BP.code,
      engine.CONDITION_CATEGORIES,
      engine.TARGET_SELECTORS,
      engine.BAND_MIN,
      engine.GRID_SIZE_BY_LEVEL,
      engine.GRID_SIZE_BY_LEVEL[0],
    ];
    for (const v of frozen) expect(Object.isFrozen(v)).toBe(true);
    expect(() => (engine.TYPES as unknown as string[]).push('fire')).toThrow(TypeError);
    expect(engine.moveDef('ship-it')).toBe(engine.MOVES['ship-it']);
    expect(engine.moveDef('no-such-move')).toBeNull();
    expect(engine.typeMultiplierBp('code', ['vision'])).toBe(engine.TYPE_CHART_BP.code.vision);
    expect([engine.MAX_DECK_CARDS, engine.MAX_AUTOPILOT_CARDS]).toEqual([12, 12]);
    expect(engine.CONDITION_CATEGORIES).toContain('coin');
    expect(engine.TARGET_SELECTORS).toHaveLength(8);
    expect(engine.BAND_MIN).toEqual({ robust: 70, stable: 40 });
    expect(engine.gridSizeFor(8)).toEqual({ width: 5, height: 5 });
    expect([engine.bandFor(70), engine.bandFor(69), engine.bandFor(40), engine.bandFor(39)]).toEqual(['robust', 'stable', 'stable', 'brittle']);
  });

  it('types: Intent has no replanned (m1), CardTrace is the CardTrace event (m3), ValidationErrorCode is every validator code (m2)', () => {
    expectTypeOf<engine.Intent>().toEqualTypeOf<{ actor: number; moveId: string; target: number; cardId: string | null }>();
    expectTypeOf<engine.CardTrace>().toEqualTypeOf<Extract<engine.BattleEvent, { type: 'CardTrace' }>>();
    expectTypeOf<engine.ValidationError['code']>().toEqualTypeOf<engine.ValidationErrorCode>();
    expectTypeOf<engine.GridError['code']>().toEqualTypeOf<engine.ValidationErrorCode>();
    // Exhaustive both ways: a code missing here, or one the union lacks, fails typecheck.
    const codes: Record<engine.ValidationErrorCode, true> = {
      shape: true,
      seed: true,
      duplicateId: true,
      unknownId: true,
      level: true,
      version: true,
      range: true,
      orchestratorField: true,
      movesFromGrid: true,
      moveCount: true,
      moveNotKnown: true,
      universalListed: true,
      duplicateMove: true,
      slotBinding: true,
      activeCount: true,
      benchCount: true,
      deckDefault: true,
      deckSize: true,
      cardSubject: true,
      gridSize: true,
      overlap: true,
      bounds: true,
      systemPromptCount: true,
      skillCount: true,
      headroomFloor: true,
    };
    expect(Object.keys(codes)).toHaveLength(25);
    const r = engine.validateSetup({});
    expect(r.errors.every((e) => e.code in codes)).toBe(true);
  });

  it('exports the thrown error classes as values, so callers can use instanceof (Ruling 67)', () => {
    const orch = (id: string, species: string): engine.CreatureSetup => ({ id, species, level: 1, version: 'v1', moves: [] });
    const side = (o: engine.CreatureSetup): engine.SideSetup => ({ orchestrator: o, active: [], bench: [], grid: null, opponentId: 'z' });
    const seed = '0123456789abcdef0123456789abcdef';
    expect(() => engine.createBattle({ a: side(orch('x', 'nope')), b: side(orch('y', 'sagelet')), kind: 'wild' }, seed)).toThrow(engine.SetupError);
    const bad: engine.RoundCommand = { a: { temperature: 2, action: { kind: 'move', moveId: 'no-such-move', target: 1 } } };
    expect(() => engine.simulate({ a: side(orch('x', 'sagelet')), b: side(orch('y', 'sagelet')), kind: 'wild' }, seed, { kind: 'recorded', rounds: [bad] })).toThrow(engine.SimulateError);
    expect(new engine.EngineInvariantError('x')).toBeInstanceOf(Error);
  });
});
