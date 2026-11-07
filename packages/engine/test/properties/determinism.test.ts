import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, type BattleLog, type RoundCommand } from '../../src/battle/log.js';
import { replay } from '../../src/battle/replay.js';
import { createBattle, type BattleSetup } from '../../src/battle/setup.js';
import { simulate, SimulateError, type BattleResult, type CommandSource } from '../../src/battle/simulate.js';
import { submitRound } from '../../src/battle/round.js';
import type { BattleEvent } from '../../src/events/types.js';
import { eventStreamHash } from '../../src/events/canonical.js';
import { gridlessSetup, mon, SEED } from '../battle/helpers.js';
import { arbLegalSetup, arbScriptedCommands, arbSeed, scriptedFrom } from '../helpers/arbitraries.js';

const DEFAULTS: CommandSource = { kind: 'recorded', rounds: [] };

/** The same battle driven round by round through the public submitRound (a clone per round). */
function viaSubmitRound(setup: BattleSetup, seed: string, rounds: readonly RoundCommand[]): BattleEvent[] {
  let state = createBattle(setup, seed);
  const events: BattleEvent[] = [];
  for (let i = 0; !state.ended; i++) {
    const out = submitRound(state, rounds[i] ?? {});
    if ('error' in out) throw new Error(out.error.message);
    events.push(...out.events);
    state = out.state;
  }
  return events;
}

const isError = (r: BattleResult | { error: unknown }): r is { error: unknown } => 'error' in r;

function replayed(log: unknown): BattleResult {
  const r = replay(log as BattleLog);
  if (isError(r)) throw new Error(`replay failed: ${JSON.stringify(r.error)}`);
  return r;
}

describe('simulate', () => {
  it('runs a default-intent battle to its end and reports winner, rounds, events, hash and log', () => {
    const setup = gridlessSetup();
    const r = simulate(setup, SEED, DEFAULTS);
    const end = r.events[r.events.length - 1];
    expect(end?.type).toBe('BattleEnd');
    expect(r.events.filter((e) => e.type === 'BattleEnd')).toHaveLength(1);
    expect(r.rounds).toBe(end?.round);
    expect(r.rounds).toBeGreaterThanOrEqual(1);
    expect(r.rounds).toBeLessThanOrEqual(50);
    const winner = end?.type === 'BattleEnd' ? end.winner : undefined;
    expect(r.winner).toBe(winner === 0 ? 'a' : winner === 1 ? 'b' : 'draw');
    expect(r.hash).toBe(eventStreamHash(r.events));
    expect(r.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(r.log).toEqual({ engineVersion: ENGINE_VERSION, seed: SEED, setup, rounds: Array.from({ length: r.rounds }, () => ({})) });
  });

  it('produces exactly the events of a round-by-round submitRound run (in-place mutation changes nothing)', () => {
    fc.assert(
      fc.property(arbLegalSetup, arbSeed, arbScriptedCommands, (setup, seed, source) => {
        const r = simulate(setup, seed, source);
        expect(viaSubmitRound(setup, seed, r.log.rounds)).toEqual(r.events);
      }),
      { numRuns: 40 },
    );
  });

  it('records exactly the commands it submitted and shares no objects with the setup', () => {
    const setup = gridlessSetup();
    const r = simulate(setup, SEED, scriptedFrom([3, 1, 4, 1, 5, 9, 2, 6]));
    expect(r.log.rounds).toHaveLength(r.rounds);
    expect(r.log.rounds.every((c) => c.a !== undefined && c.b !== undefined)).toBe(true);
    expect(r.log.setup).toEqual(setup);
    expect(r.log.setup).not.toBe(setup);
    setup.a.orchestrator.level = 99;
    expect(r.log.setup.a.orchestrator.level).toBe(5);
  });

  it('feeds recorded rounds in order and an empty command once they run out', () => {
    const first: RoundCommand = { a: { temperature: 4, action: { kind: 'none' } } };
    const r = simulate(gridlessSetup(), SEED, { kind: 'recorded', rounds: [first] });
    expect(r.log.rounds[0]).toEqual(first);
    expect(r.log.rounds.slice(1).every((c) => Object.keys(c).length === 0)).toBe(true);
  });

  it('throws SimulateError for autopilot (until B4) and for a command submitRound rejects', () => {
    expect(() => simulate(gridlessSetup(), SEED, { kind: 'autopilot' })).toThrow(SimulateError);
    try {
      simulate(gridlessSetup(), SEED, { kind: 'autopilot' });
    } catch (e) {
      expect((e as SimulateError).code).toBe('autopilotUnavailable');
    }
    const bad: RoundCommand = { a: { temperature: 2, action: { kind: 'move', moveId: 'no-such-move', target: 6 } } };
    try {
      simulate(gridlessSetup(), SEED, { kind: 'recorded', rounds: [bad] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SimulateError);
      expect((e as SimulateError).code).toBe('invalidCommand');
      expect((e as SimulateError).round).toBe(1);
      expect((e as SimulateError).command?.code).toBe('unknownMove');
    }
  });
});

describe('determinism and replay (spec §2 criterion 2, §8 properties)', () => {
  it('same setup, seed and commands → same hash; replay(log) reproduces result and hash', () => {
    fc.assert(
      fc.property(arbLegalSetup, arbSeed, arbScriptedCommands, (setup, seed, source) => {
        const first = simulate(setup, seed, source);
        const second = simulate(setup, seed, source);
        expect(second.hash).toBe(first.hash);
        const again = replayed(first.log);
        expect(again.hash).toBe(first.hash);
        expect(again.winner).toBe(first.winner);
        expect(again.rounds).toBe(first.rounds);
        expect(again.log).toEqual(first.log);
      }),
      { numRuns: 60 },
    );
  });

  it('replays a log that went through JSON', () => {
    const r = simulate(gridlessSetup(), SEED, scriptedFrom([7, 0, 2, 11]));
    expect(replayed(JSON.parse(JSON.stringify(r.log))).hash).toBe(r.hash);
  });

  it('does not modify the log it replays', () => {
    const r = simulate(gridlessSetup(), SEED, scriptedFrom([7, 0, 2, 11]));
    const copy = structuredClone(r.log);
    replayed(r.log);
    expect(r.log).toEqual(copy);
  });

  it('a logged setup edited after recording (one move changed, same seed) replays to a different hash (Review Focus 4)', () => {
    const setup = gridlessSetup({ active: [{ ...mon('a-act1', 'blitzr'), moves: ['token-burst'] }, mon('a-act2', 'forkling')] });
    const r = simulate(setup, SEED, DEFAULTS);
    const edited = structuredClone(r.log);
    (edited.setup.a.active[0] as { moves: string[] }).moves = ['ship-it'];
    const again = replayed(edited);
    expect(again.hash).not.toBe(r.hash);
  });

  it('a different seed gives a different hash', () => {
    const r = simulate(gridlessSetup(), SEED, DEFAULTS);
    expect(simulate(gridlessSetup(), 'fedcba9876543210fedcba9876543210', DEFAULTS).hash).not.toBe(r.hash);
  });
});

describe('replay errors (Rulings 69, 70, 75): typed, never thrown', () => {
  const good = (): BattleLog => simulate(gridlessSetup(), SEED, DEFAULTS).log;
  const malformed = { error: { code: 'malformed' } };

  it.each([
    ['{}', {}],
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['a number', 7],
    ['a string', 'log'],
  ])('replay(%s) → malformed', (_name, log) => {
    expect(replay(log as unknown as BattleLog)).toEqual(malformed);
  });

  it.each<[string, (l: Record<string, unknown>) => void]>([
    ['engineVersion not a string', (l) => (l.engineVersion = 1)],
    ['seed missing', (l) => delete l.seed],
    ['seed not a string', (l) => (l.seed = 12)],
    ['seed not 32 lowercase hex', (l) => (l.seed = 'ABCDEF0123456789ABCDEF0123456789')],
    ['seed all zero', (l) => (l.seed = '0'.repeat(32))],
    ['setup null', (l) => (l.setup = null)],
    ['setup an array', (l) => (l.setup = [])],
    ['side b missing', (l) => delete (l.setup as Record<string, unknown>).b],
    ['side a a string', (l) => ((l.setup as Record<string, unknown>).a = 'a')],
    ['orchestrator null', (l) => ((l.setup as { a: Record<string, unknown> }).a.orchestrator = null)],
    ['orchestrator an array', (l) => ((l.setup as { a: Record<string, unknown> }).a.orchestrator = [])],
    ['active not an array', (l) => ((l.setup as { a: Record<string, unknown> }).a.active = {})],
    ['bench null', (l) => ((l.setup as { b: Record<string, unknown> }).b.bench = null)],
    ['a bench entry null', (l) => ((l.setup as { b: { bench: unknown[] } }).b.bench[0] = null)],
    ['an active entry without moves', (l) => delete (l.setup as { a: { active: Record<string, unknown>[] } }).a.active[0]?.moves],
    ['moves holding a number', (l) => ((l.setup as { a: { active: { moves: unknown[] }[] } }).a.active[0]!.moves = [3])],
    ['species not a string', (l) => ((l.setup as { a: { orchestrator: Record<string, unknown> } }).a.orchestrator.species = 4)],
    ['grid a string', (l) => ((l.setup as { a: Record<string, unknown> }).a.grid = 'grid')],
    ['grid pieces holding null', (l) => ((l.setup as { a: Record<string, unknown> }).a.grid = { width: 4, height: 4, pieces: [null] })],
    ['autopilot null', (l) => ((l.setup as { a: Record<string, unknown> }).a.autopilot = null)],
    ['rounds missing', (l) => delete l.rounds],
    ['rounds an object', (l) => (l.rounds = {})],
    ['a round null', (l) => (l.rounds = [null])],
    ['a round an array', (l) => (l.rounds = [[]])],
    ['a side command a number', (l) => (l.rounds = [{ a: 3 }])],
    ['a round command submitRound rejects', (l) => (l.rounds = [{ a: { temperature: 2, action: { kind: 'move', moveId: 'nope', target: 6 } } }])],
    ['a round after the battle ended', (l) => (l.rounds as unknown[]).push({})],
  ])('%s → malformed', (_name, edit) => {
    const log = good() as unknown as Record<string, unknown>;
    edit(log);
    expect(replay(log as unknown as BattleLog)).toEqual(malformed);
  });

  it('a different engineVersion → version', () => {
    expect(replay({ ...good(), engineVersion: '0.0.9' })).toEqual({ error: { code: 'version' } });
  });

  it('a different engineVersion with a different shape → version, not malformed (Ruling 69)', () => {
    const version = { error: { code: 'version' } };
    expect(replay({ engineVersion: '9.9.9' } as unknown as BattleLog)).toEqual(version);
    expect(replay({ engineVersion: '0.0.9', seed: 4, setup: [], rounds: 'x' } as unknown as BattleLog)).toEqual(version);
    expect(replay({ ...good(), engineVersion: '0.2.0', setup: { a: 1 } } as unknown as BattleLog)).toEqual(version);
  });

  it('a log whose rounds run out before the battle ends → malformed, never padded (Ruling 70)', () => {
    const full = simulate(gridlessSetup(), SEED, scriptedFrom([7, 0, 2, 11])).log;
    expect(full.rounds.length).toBeGreaterThan(1);
    expect(replayed(full).rounds).toBe(full.rounds.length);
    const short = { ...full, rounds: full.rounds.slice(0, -1) };
    expect(replay(short)).toEqual(malformed);
    expect(replay({ ...full, rounds: [] })).toEqual(malformed);
  });

  it('a well-formed setup validateSetup rejects → invalidSetup', () => {
    const log = good();
    log.setup.a.orchestrator.species = 'missingno';
    expect(replay(log)).toEqual({ error: { code: 'invalidSetup' } });
    const dup = good();
    dup.setup.b.orchestrator.id = dup.setup.a.orchestrator.id;
    expect(replay(dup)).toEqual({ error: { code: 'invalidSetup' } });
  });

  it('never throws on arbitrary JSON-ish input', () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        const r = replay(v as BattleLog);
        expect('error' in r).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it('never throws on a valid log with one field replaced by arbitrary data', () => {
    const base = good() as unknown as Record<string, unknown>;
    const paths: string[][] = [['engineVersion'], ['seed'], ['setup'], ['rounds'], ['setup', 'a'], ['setup', 'a', 'orchestrator'], ['setup', 'a', 'active'], ['setup', 'b', 'bench'], ['setup', 'a', 'grid'], ['setup', 'kind'], ['setup', 'a', 'orchestrator', 'level'], ['setup', 'a', 'orchestrator', 'moves']];
    fc.assert(
      fc.property(fc.constantFrom(...paths), fc.anything(), (path, v) => {
        const log = structuredClone(base);
        let at: Record<string, unknown> = log;
        for (const k of path.slice(0, -1)) at = at[k] as Record<string, unknown>;
        at[path[path.length - 1] as string] = v;
        expect(() => replay(log as unknown as BattleLog)).not.toThrow();
      }),
      { numRuns: 300 },
    );
  });
});
