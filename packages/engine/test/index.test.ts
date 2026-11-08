import { describe, expect, it } from 'vitest';
import * as engine from '../src/index.js';

describe('public surface (spec §4, so far)', () => {
  it('exports exactly the Phase A values plus getIntents (B2)', () => {
    expect(Object.keys(engine).sort()).toEqual(
      [
        'ENGINE_VERSION',
        'EngineInvariantError',
        'SetupError',
        'SimulateError',
        'activeCardCount',
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
