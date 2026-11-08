import { describe, expect, it } from 'vitest';
import * as engine from '../src/index.js';

describe('public surface (spec §4, so far)', () => {
  it('exports exactly the Phase A values plus getIntents (B2), computeGeneralization and DEPRECATED_FOREST_SUITE (B5)', () => {
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
      ].sort(),
    );
    expect(engine.ENGINE_VERSION).toBe('0.2.0');
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

  it('computes Generalization from a deck, the Deprecated Forest suite and active slots (B5)', () => {
    const always: engine.Condition = { category: 'turn', op: 'atLeast', round: 1 };
    const deck: engine.Deck = { cards: [], default: { id: 'd', subject: 'self', condition: always, move: 'ship-it', target: 'lowestHpFoe' } };
    const suite: engine.EvalSuite = engine.DEPRECATED_FOREST_SUITE;
    const report: engine.GeneralizationReport = engine.computeGeneralization(deck, suite, 3);
    expect(report).toEqual({ c: [0, 1], r: [0, 1], h: [0, 1], g: 20, band: 'brittle' });
    expect(() => engine.computeGeneralization(deck, suite, 9)).toThrow(engine.GeneralizationError);
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
