import { EngineInvariantError, replay, simulate, validateSetup, type BattleResult } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { fuzzCase, fuzzCommand, runFuzz, type FuzzEngine } from '../src/commands/fuzz.js';
import { csvRows, readOut, testContext } from './helpers/context.js';

describe('fuzzCase', () => {
  it('is deterministic per index and always a valid setup', () => {
    expect(fuzzCase(3)).toEqual(fuzzCase(3));
    for (let i = 0; i < 200; i++) expect(validateSetup(fuzzCase(i).setup).errors).toEqual([]);
  });
  it('covers mirrors, every Autopilot temperature and sides without an Autopilot', () => {
    const cases = Array.from({ length: 400 }, (_, i) => fuzzCase(i));
    expect(cases.some((c) => c.a === c.b)).toBe(true);
    const temps = new Set(cases.flatMap((c) => [c.setup.a.autopilot?.temperature, c.setup.b.autopilot?.temperature]));
    expect([...temps].sort()).toEqual([0, 1, 2, 3, 4, undefined]);
  });
});

/** The real engine, except that battle 0 throws an invariant error, battle 1 a TypeError, battle 2 replays to another hash and battle 3 ends at the cap. */
const FAULTY: FuzzEngine = {
  simulate: (setup, seed, source) => {
    if (seed === fuzzCase(0).seed) throw new EngineInvariantError('hp out of range', { round: 3, seed });
    if (seed === fuzzCase(1).seed) throw new TypeError('boom');
    const r = simulate(setup, seed, source);
    if (seed !== fuzzCase(3).seed) return r;
    return { ...r, events: r.events.map((e) => (e.type === 'BattleEnd' ? { ...e, reason: 'cap' } : e)) };
  },
  replay: (log) => {
    const r = replay(log);
    return log.seed === fuzzCase(2).seed && !('error' in r) ? ({ ...r, hash: 'f'.repeat(16) } as BattleResult) : r;
  },
};

describe('runFuzz', () => {
  it('counts a clean run as clean', () => {
    expect(runFuzz(40)).toMatchObject({ battles: 40, exceptions: 0, invariantErrors: 0, replayMismatches: 0, failures: [] });
  });
  it('counts and lists exceptions, invariant errors and replay mismatches, and cap hits by BattleEnd reason', () => {
    const r = runFuzz(6, { engine: FAULTY });
    expect(r).toMatchObject({ battles: 6, exceptions: 1, invariantErrors: 1, replayMismatches: 1 });
    expect(r.failures.map((f) => [f.index, f.kind])).toEqual([[0, 'invariant'], [1, 'exception'], [2, 'replay']]);
    expect(r.failures[0]).toMatchObject({ seed: fuzzCase(0).seed, a: fuzzCase(0).a, b: fuzzCase(0).b, message: 'EngineInvariantError: hp out of range' });
    expect(r.failures[2]?.message).toMatch(/^hash f{16} ≠ [0-9a-f]{16}$/);
    // A cap hit is BattleEnd.reason 'cap' (here only battle 3's, faked); a clean run's battles end by knockout.
    expect(runFuzz(6).capHits).toBe(0);
    expect(r.capHits).toBe(1);
  });
});

describe('fuzz command', () => {
  it('writes the tallies and returns 0 when every battle is clean', async () => {
    const ctx = testContext();
    expect(await fuzzCommand(['--battles', '25'], ctx)).toBe(0);
    expect(readOut(ctx, 'fuzz-2026-01-02.md')).toContain('- battles: 25');
    const rows = csvRows(readOut(ctx, 'fuzz-2026-01-02.csv'));
    expect(rows[0]).toEqual(['battles', 'exceptions', 'invariant_errors', 'replay_mismatches', 'cap_hits']);
    expect(rows[1]?.slice(0, 4)).toEqual(['25', '0', '0', '0']);
  });
  it('returns 1 and lists the failures when any battle fails', async () => {
    const ctx = testContext();
    expect(await fuzzCommand(['--battles', '6'], ctx, FAULTY)).toBe(1);
    const md = readOut(ctx, 'fuzz-2026-01-02.md');
    expect(md).toContain('- verdict: FAILED');
    expect(md).toContain('| 0 |');
    expect(csvRows(readOut(ctx, 'fuzz-2026-01-02.csv'))[1]).toEqual(['6', '1', '1', '1', '1']);
  });
});
