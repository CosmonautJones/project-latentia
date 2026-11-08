import { ENGINE_VERSION } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { UsageError } from '../src/args.js';
import { targetsCommand } from '../src/commands/targets.js';
import { measureTargets, scaled, TARGETS, targetVerdict } from '../src/targets.js';
import { csvRows, readOut, testContext } from './helpers/context.js';

// TARGETS, the seed scale and the targets command (spec §9). The setups themselves: target-setups.test.ts.

describe('TARGETS (spec §9)', () => {
  it('lists the seven targets in table order with their seeds and pass bands', () => {
    expect(TARGETS.map((t) => [t.id, t.seeds, t.band, t.pointOnly])).toEqual([
      ['vs-field', '1,000 per ordered pairing', [0, 0.55], false],
      ['worst-matchup', '2,000 per pairing', [0.3, 1], false],
      ['starter-triangle', '2,000', [0.55, 0.65], false],
      ['temperature-dial', '2,000', [0.45, 0.55], false],
      ['graft-vs-spin-up', '2,000', [0.45, 0.55], false],
      ['fight-length', 'all', [5, 8], true],
      ['first-mover', '10,000', [0.48, 0.52], false],
    ]);
    expect(Object.isFrozen(TARGETS)).toBe(true);
  });
  it('a target’s verdict is its worst row: any fail fails, else any inconclusive is inconclusive', () => {
    expect(targetVerdict(['pass', 'pass'])).toBe('pass');
    expect(targetVerdict(['pass', 'inconclusive'])).toBe('inconclusive');
    expect(targetVerdict(['inconclusive', 'fail', 'pass'])).toBe('fail');
  });
});

describe('scaled (--seeds-scale)', () => {
  it('multiplies, rounds up, and never goes below 1', () => {
    expect(scaled(1000, 1)).toBe(1000);
    expect(scaled(1000, 0.01)).toBe(10);
    expect(scaled(500, 0.003)).toBe(2);
    expect(scaled(1000, 0.0001)).toBe(1);
    expect(scaled(100, 0.07)).toBe(7); // 100 * 0.07 is 7.000000000000001 in floating point
    expect(scaled(1000, 2.5)).toBe(2500);
  });
});

describe('measureTargets', () => {
  it('is deterministic: the same scale gives the same rows', () => {
    const opts = { scale: 0.001, now: () => 0, progress: () => undefined };
    const a = measureTargets(opts).rows;
    expect(measureTargets(opts).rows).toEqual(a);
  }, 120_000);
});

describe('targets command', () => {
  it('runs `targets --seeds-scale 0.01` and reports every target', async () => {
    const ctx = testContext();
    expect(await targetsCommand(['--seeds-scale', '0.01'], ctx)).toBe(0);
    const md = readOut(ctx, 'targets-2026-01-02.md');
    for (const t of TARGETS) expect(md).toContain(t.name);
    const rows = csvRows(readOut(ctx, 'targets-2026-01-02.csv')).slice(1);
    const battles = (target: string) => rows.filter((r) => r[0] === target).map((r) => Number(r[2]));
    expect(battles('vs-field')).toEqual(Array(20).fill(380));
    expect(battles('worst-matchup')).toEqual(Array(21).fill(20));
    expect(battles('starter-triangle')).toEqual([20, 20, 20]);
    expect(battles('temperature-dial')).toEqual([20]);
    expect(battles('graft-vs-spin-up')).toEqual([20, 20, 20]);
    expect(battles('fight-length')).toEqual([3800]);
    expect(battles('first-mover')).toEqual([100]);
    for (const r of rows) expect(['pass', 'fail', 'inconclusive']).toContain(r[8]);
    for (const r of rows) expect(r.slice(9)).toEqual(['0.01', ENGINE_VERSION]);
    // Row keys (target, subject) do not depend on the scale, so runs at different scales line up.
    expect(rows.find((r) => r[0] === 'first-mover')?.[1]).toBe('side A vs its mirror, every archetype pooled');
    expect(ctx.lines.length).toBeGreaterThan(0);
  }, 120_000);
  it('rejects a seed scale that is not a positive number', async () => {
    for (const bad of ['0', '-1', 'abc', '']) await expect(targetsCommand(['--seeds-scale', bad], testContext())).rejects.toThrow(UsageError);
  });
});
