import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_VERSION } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { fmtInterval, fmtPct, PROVENANCE_COLUMNS, renderCsv, renderMarkdown, withProvenance, writeReport, type Provenance, type Report } from '../src/report.js';
import { targetsReport } from '../src/commands/targets.js';
import { activeCardCount } from '@latentia/engine';
import { ARCHETYPES } from '../src/archetypes/index.js';
import { baseTeam, GRAFT_SPECIES, graftVariant, SPIN_UP_LEVEL, spinUpVariant, starterSide, TRIANGLE } from '../src/target-setups.js';
import { TARGETS, type TargetId, type TargetsRun } from '../src/targets.js';
import { readOut, TEST_PROVENANCE, testContext } from './helpers/context.js';

const REPORT: Report = {
  command: 'demo',
  date: '2026-01-02',
  args: ['--seeds', '3'],
  seedScale: { value: '3', unit: 'seeds per ordered pairing' },
  meta: [
    ['seeds', '3 per ordered pairing'],
    ['wall time', '1.2 s'],
  ],
  sections: [{ heading: 'Results', text: ['One line.'], table: { columns: ['name', 'value'], rows: [['a', 1], ['b|c', 2.5]] } }],
  csv: { columns: ['name', 'value'], rows: [['a', 1], ['b,"c"', 2.5]] },
};

describe('renderCsv', () => {
  it('writes a header and one line per row, quoting cells with commas or quotes', () => {
    expect(renderCsv(REPORT.csv)).toBe('name,value\na,1\n"b,""c""",2.5\n');
  });
});

const P = TEST_PROVENANCE;

describe('withProvenance (Ruling 143 I5)', () => {
  it('appends engine version, seed scale, content fingerprint, git SHA and dirty flag to the header and every row', () => {
    const t = withProvenance(REPORT.csv, REPORT, P);
    expect(t.columns).toEqual(['name', 'value', ...PROVENANCE_COLUMNS]);
    expect(PROVENANCE_COLUMNS).toEqual(['engine_version', 'seed_scale', 'content_fingerprint', 'git_sha', 'git_dirty']);
    for (const r of t.rows) expect(r.slice(2)).toEqual([ENGINE_VERSION, '3', P.fingerprint, P.git?.sha, 'false']);
    expect(withProvenance(REPORT.csv, REPORT, { ...P, git: null }).rows[0]?.slice(5)).toEqual(['unknown', 'unknown']);
  });
});

describe('renderMarkdown', () => {
  it('heads with the command and date, then the engine version, command line, provenance and meta', () => {
    const md = renderMarkdown(REPORT, P);
    expect(md.startsWith('# demo — 2026-01-02\n')).toBe(true);
    expect(md).toContain(`- engine: \`@latentia/engine\` ${ENGINE_VERSION}`);
    expect(md).toContain('- command: `pnpm sim demo --seeds 3`');
    expect(md).toContain('- seed scale: 3 (seeds per ordered pairing)');
    expect(md).toContain(`- content fingerprint: ${P.fingerprint} (`);
    expect(md).toContain(`- git: ${P.git?.sha} (clean)`);
    const dirty: Provenance = { ...P, git: { sha: 'abc', dirty: true } };
    expect(renderMarkdown(REPORT, dirty)).toContain('- git: abc (dirty: the work tree differed from it outside reports/)');
    expect(renderMarkdown(REPORT, { ...P, git: null })).toContain('- git: unknown (git unavailable)');
    expect(md).toContain('- seeds: 3 per ordered pairing');
    expect(md).toContain('- wall time: 1.2 s');
  });
  it('renders each section as a heading, its text and a table (pipes escaped)', () => {
    const md = renderMarkdown(REPORT, P);
    expect(md).toContain('## Results\n\nOne line.\n\n| name | value |\n|---|---|\n| a | 1 |\n| b\\|c | 2.5 |\n');
  });
});

describe('writeReport', () => {
  it('writes <command>-<date>.md and .csv, both with the provenance, into the given directory and returns their paths', () => {
    const ctx = testContext();
    const out = writeReport(REPORT, ctx);
    expect(out).toEqual({ md: join(ctx.outDir, 'demo-2026-01-02.md'), csv: join(ctx.outDir, 'demo-2026-01-02.csv') });
    expect(readOut(ctx, 'demo-2026-01-02.md')).toBe(renderMarkdown(REPORT, P));
    expect(readOut(ctx, 'demo-2026-01-02.csv')).toBe(renderCsv(withProvenance(REPORT.csv, REPORT, P)));
  });
  it('appends a tag to the file names', () => {
    const ctx = testContext();
    expect(writeReport({ ...REPORT, tag: 'scratch' }, ctx).md).toBe(join(ctx.outDir, 'demo-2026-01-02-scratch.md'));
    expect(readOut(ctx, 'demo-2026-01-02-scratch.csv')).toBe(renderCsv(withProvenance(REPORT.csv, REPORT, P)));
  });
  it('creates the directory when it does not exist', () => {
    const dir = join(testContext().outDir, 'nested', 'reports');
    writeReport(REPORT, { outDir: dir, provenance: P });
    expect(existsSync(join(dir, 'demo-2026-01-02.md'))).toBe(true);
  });
});

describe('formatting', () => {
  it('percentages to one decimal and intervals as [lo, hi]', () => {
    expect(fmtPct(0.5432)).toBe('54.3%');
    expect(fmtInterval([0.3, 0.351])).toBe('[30.0%, 35.1%]');
  });
});

describe('targetsReport', () => {
  // A synthetic run: one target row per target, plus a failing summary row and a failing diagnostic row on the first
  // target (which must not change its counts or verdict), so the test pins the report's shape without simulating.
  const run: TargetsRun = {
    scale: 0.5,
    rows: [
      ...TARGETS.map((t, i) => ({
        target: t.id,
        role: 'target' as const,
        subject: `subject-${i}`,
        battles: 100 + i,
        point: t.id === 'fight-length' ? 6.5 : 0.5,
        interval: t.pointOnly ? null : ([0.45, 0.55] as [number, number]),
        verdict: i % 3 === 0 ? ('pass' as const) : i % 3 === 1 ? ('fail' as const) : ('inconclusive' as const),
      })),
      { target: 'vs-field', role: 'summary', subject: 'summary-row', battles: 7, point: 0.9, interval: [0.8, 0.95], verdict: 'fail' },
      { target: 'vs-field', role: 'diagnostic', subject: 'diagnostic-row', battles: 8, point: 0.9, interval: [0.8, 0.95], verdict: 'fail' },
    ],
    measurements: [{ name: 'round-robin', targets: ['vs-field'], battles: 380, ms: 2500 }],
    seeds: Object.fromEntries(TARGETS.map((t) => [t.id, `run-${t.id}`])) as Record<TargetId, string>,
  };
  const report = targetsReport(run, { date: '2026-01-02', args: ['--seeds-scale', '0.5'], wallMs: 3000 });
  const md = renderMarkdown(report, P);

  it('lists every target with its point, interval (or "point only") and verdict', () => {
    for (const [i, t] of TARGETS.entries()) {
      const line = md.split('\n').find((l) => l.includes(`subject-${i}`));
      expect(line, t.id).toBeDefined();
      expect(line).toContain(t.name);
      expect(line).toContain(t.pointOnly ? 'point only' : '[45.0%, 55.0%]');
      expect(line).toContain(t.id === 'fight-length' ? '6.5' : '50.0%');
      expect(line).toContain(run.rows[i]?.verdict);
    }
  });
  it('summarises each target once with its band, §9 seeds, seeds run and overall verdict', () => {
    for (const t of TARGETS) expect(md).toContain(`| ${t.name} | ${t.bandText} | ${t.seeds} | run-${t.id} |`);
  });
  it('counts only target rows: summary and diagnostic rows are labelled and left out of pass/fail and the verdict', () => {
    // vs-field: 1 target row (pass), 0 inconclusive, 0 fail, 2 not counted, verdict pass.
    expect(md).toContain(`| ${TARGETS[0]?.name} | ${TARGETS[0]?.bandText} | ${TARGETS[0]?.seeds} | run-vs-field | 1 | 1 | 0 | 0 | 2 | pass |`);
    expect(md).toContain('| summary-row | 7 | 90.0% | [80.0%, 95.0%] | fail (summary: repeats a row above, not counted) |');
    expect(md).toContain('| diagnostic-row | 8 | 90.0% | [80.0%, 95.0%] | diagnostic (reads fail against the band; not counted) |');
  });
  it('describes each setup from the setup objects themselves', () => {
    for (const [fav, beaten] of TRIANGLE) {
      const s = starterSide(fav).side;
      expect(s.active).toEqual([]);
      expect(md).toContain(`${fav} L${s.orchestrator.level} alone vs ${beaten} L8 alone`);
    }
    const base = baseTeam().side;
    expect(md).toContain(`the base team (${base.orchestrator.species} L8 + tokenibble L8) plus a graft against the same base team without it`);
    expect(md).toContain(`each of the ${ARCHETYPES.length} archetypes at Autopilot T0 vs its own mirror at T4, both sides, pooled`);
    for (const sp of GRAFT_SPECIES) {
      const g = graftVariant(sp).side;
      const s = spinUpVariant(sp).side;
      const graft = g.grid?.pieces.find((p) => p.kind === 'graft');
      const spun = s.active[1];
      const active = s.grid === null ? 0 : activeCardCount(s.grid, 'slot-B', 'v1');
      expect(md).toContain(`${sp}: G = base team + graft ${graft?.moveId} (${graft?.shape.length} cells); S = base team + ${sp} L${spun?.level} spun up with moves ${spun?.moves.join(', ')} (no signature) on ${active} active card`);
      expect(active).toBe(1);
      expect(md).toContain(`${sp} L${SPIN_UP_LEVEL}`);
    }
    expect(md).toContain(`First mover: ${ARCHETYPES.length} archetypes`);
  });
  it('records the engine version, the seed scale, and wall time per command and per measurement', () => {
    expect(md).toContain(`${ENGINE_VERSION}`);
    expect(md).toContain('- seed scale: 0.5 (--seeds-scale');
    expect(md).toContain('- wall time: 3.0 s');
    expect(md).toContain('| round-robin | vs-field | 380 | 2.5 s |');
  });
  it('writes one CSV row per row with its role and the raw numbers (provenance columns are appended by writeReport)', () => {
    expect(report.csv.columns).toEqual(['target', 'role', 'subject', 'battles', 'point', 'interval_lo', 'interval_hi', 'band_lo', 'band_hi', 'verdict']);
    expect(report.csv.rows).toHaveLength(TARGETS.length + 2);
    const fight = report.csv.rows.find((r) => r[0] === 'fight-length');
    expect(fight?.slice(1)).toEqual(['target', 'subject-5', 105, 6.5, '', '', 5, 8, run.rows.find((r) => r.target === 'fight-length')?.verdict]);
    expect(report.csv.rows.filter((r) => r[1] !== 'target').map((r) => r[1])).toEqual(['summary', 'diagnostic']);
    expect(report.seedScale).toMatchObject({ value: '0.5' });
  });
});
