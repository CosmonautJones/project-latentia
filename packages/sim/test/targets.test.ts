import { ENGINE_VERSION } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { UsageError } from '../src/args.js';
import { targetsCommand } from '../src/commands/targets.js';
import { GRAFT_SPECIES } from '../src/target-setups.js';
import { measureTargets, scaled, TARGETS, targetVerdict } from '../src/targets.js';
import { PROVENANCE_COLUMNS } from '../src/report.js';
import { csvRows, readOut, TEST_PROVENANCE, testContext } from './helpers/context.js';

// TARGETS, the seed scale and the targets command (spec §9). The setups themselves: target-setups.test.ts.

describe('TARGETS (spec §9)', () => {
  it('lists the seven targets in table order with their seeds and pass bands', () => {
    expect(TARGETS.map((t) => [t.id, t.seeds, t.band, t.pointOnly])).toEqual([
      ['vs-field', '1,000 per ordered pairing', [0, 0.55], false],
      ['worst-matchup', '2,000 per pairing', [0.3, 1], false],
      ['starter-triangle', '2,000', [0.55, 0.65], false],
      ['temperature-dial', '2,000', [0.45, 0.55], false],
      ['graft-vs-spin-up', '2,000', [0.55, 1], false],
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
  it('keeps the summary and diagnostic rows out of the verdicts', () => {
    const run = measureTargets({ scale: 0.002, now: () => 0, progress: () => undefined });
    const roles = (t: string) => run.rows.filter((r) => r.target === t).map((r) => r.role);
    expect(roles('worst-matchup').filter((r) => r === 'summary')).toHaveLength(1);
    expect(roles('starter-triangle')).toEqual(['target', 'target', 'target']);
    expect(roles('graft-vs-spin-up')).toEqual(['target', 'target', 'target', 'diagnostic', 'diagnostic', 'diagnostic']);
    expect(roles('temperature-dial')).toEqual(['target', ...Array(20).fill('diagnostic')]);
    for (const t of ['vs-field', 'starter-triangle', 'fight-length', 'first-mover']) expect(roles(t).every((r) => r === 'target')).toBe(true);
  }, 120_000);

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
    const [header, ...rows] = csvRows(readOut(ctx, 'targets-2026-01-02.csv'));
    expect(header).toEqual(['target', 'role', 'subject', 'battles', 'point', 'interval_lo', 'interval_hi', 'band_lo', 'band_hi', 'verdict', ...PROVENANCE_COLUMNS]);
    const battles = (target: string, role = 'target') => rows.filter((r) => r[0] === target && r[1] === role).map((r) => Number(r[3]));
    expect(battles('vs-field')).toEqual(Array(20).fill(380));
    expect(battles('worst-matchup')).toEqual(Array(20).fill(20));
    expect(battles('worst-matchup', 'summary')).toEqual([20]);
    expect(battles('starter-triangle')).toEqual([20, 20, 20]);
    // Ruling 143 I2: 1 seed per side (50 × 0.01) for each of the 20 archetypes, pooled into one row; the sweep is 3 per side (250 × 0.01, rounded up).
    expect(battles('temperature-dial')).toEqual([40]);
    expect(battles('temperature-dial', 'diagnostic')).toEqual(Array(20).fill(6));
    expect(battles('graft-vs-spin-up')).toEqual([20, 20, 20]);
    expect(battles('graft-vs-spin-up', 'diagnostic')).toEqual([20, 20, 20]);
    expect(battles('fight-length')).toEqual([3800]);
    expect(battles('first-mover')).toEqual([100]);
    expect(rows.every((r) => ['target', 'summary', 'diagnostic'].includes(r[1] as string))).toBe(true);
    for (const r of rows) expect(['pass', 'fail', 'inconclusive']).toContain(r[9]);
    for (const r of rows) expect(r.slice(10)).toEqual([ENGINE_VERSION, '0.01', TEST_PROVENANCE.fingerprint, TEST_PROVENANCE.git?.sha, 'false']);
    // Row keys (target, subject) do not depend on the scale, so runs at different scales line up.
    // Ruling 146: the official triangle rows are the partnerless ones; Ruling 147: the official graft rows are "worth taking".
    expect(rows.filter((r) => r[0] === 'starter-triangle').map((r) => r[2])).toEqual(['blitzr (favoured) vs sagelet', 'sagelet (favoured) vs forkling', 'forkling (favoured) vs blitzr']);
    expect(rows.filter((r) => r[0] === 'graft-vs-spin-up' && r[1] === 'target').map((r) => r[2])).toEqual(GRAFT_SPECIES.map((sp) => `${sp}: base team + graft vs base team alone`));
    expect(rows.filter((r) => r[0] === 'graft-vs-spin-up' && r[1] === 'diagnostic').map((r) => r[2])).toEqual(GRAFT_SPECIES.map((sp) => `diagnostic: ${sp}: graft (G) vs spin-up (S)`));
    expect(rows.find((r) => r[0] === 'first-mover')?.[2]).toBe('side A vs its mirror, every archetype pooled');
    expect(rows.find((r) => r[0] === 'temperature-dial')?.[2]).toBe('T0 side vs its T4 mirror, every archetype pooled');
    // The seeds-run column shows the scaled counts actually played.
    expect(md).toContain('| Temperature dial | within 5 points of 50% | 2,000 | 40 (1 per side × 2 sides × 20 archetypes) |');
    expect(md).toContain('| Any archetype vs the field | ≤ 55% | 1,000 per ordered pairing | 10 per ordered pairing |');
    expect(md).toContain('| First mover | 48–52% | 10,000 | 100 (5 × 20 archetypes) |');
    expect(ctx.lines.length).toBeGreaterThan(0);
  }, 120_000);
  it('rejects a seed scale that is not a positive number', async () => {
    for (const bad of ['0', '-1', 'abc', '']) await expect(targetsCommand(['--seeds-scale', bad], testContext())).rejects.toThrow(UsageError);
  });
});
