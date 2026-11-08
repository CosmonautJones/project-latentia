import { validateSetup } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { fuzzCase, fuzzCommand, runFuzz } from '../src/commands/fuzz.js';
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

describe('runFuzz', () => {
  it('counts battles, exceptions, invariant errors, replay mismatches and cap hits', () => {
    const r = runFuzz(40);
    expect(r.battles).toBe(40);
    expect(r).toMatchObject({ exceptions: 0, invariantErrors: 0, replayMismatches: 0, failures: [] });
    expect(r.capHits).toBeGreaterThanOrEqual(0);
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
});
