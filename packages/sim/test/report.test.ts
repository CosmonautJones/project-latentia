import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_VERSION } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { fmtInterval, fmtPct, renderCsv, renderMarkdown, writeReport, type Report } from '../src/report.js';
import { targetsReport } from '../src/commands/targets.js';
import { TARGETS, type TargetsRun } from '../src/targets.js';
import { readOut, testContext } from './helpers/context.js';

const REPORT: Report = {
  command: 'demo',
  date: '2026-01-02',
  args: ['--seeds', '3'],
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

describe('renderMarkdown', () => {
  it('heads with the command and date, then the engine version, command line and meta', () => {
    const md = renderMarkdown(REPORT);
    expect(md.startsWith('# demo — 2026-01-02\n')).toBe(true);
    expect(md).toContain(`- engine: \`@latentia/engine\` ${ENGINE_VERSION}`);
    expect(md).toContain('- command: `pnpm sim demo --seeds 3`');
    expect(md).toContain('- seeds: 3 per ordered pairing');
    expect(md).toContain('- wall time: 1.2 s');
  });
  it('renders each section as a heading, its text and a table (pipes escaped)', () => {
    const md = renderMarkdown(REPORT);
    expect(md).toContain('## Results\n\nOne line.\n\n| name | value |\n|---|---|\n| a | 1 |\n| b\\|c | 2.5 |\n');
  });
});

describe('writeReport', () => {
  it('writes <command>-<date>.md and .csv into the given directory and returns their paths', () => {
    const ctx = testContext();
    const out = writeReport(REPORT, ctx.outDir);
    expect(out).toEqual({ md: join(ctx.outDir, 'demo-2026-01-02.md'), csv: join(ctx.outDir, 'demo-2026-01-02.csv') });
    expect(readOut(ctx, 'demo-2026-01-02.md')).toBe(renderMarkdown(REPORT));
    expect(readOut(ctx, 'demo-2026-01-02.csv')).toBe(renderCsv(REPORT.csv));
  });
  it('creates the directory when it does not exist', () => {
    const dir = join(testContext().outDir, 'nested', 'reports');
    writeReport(REPORT, dir);
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
  // A synthetic run: one row per target, so the test pins the report's shape without simulating.
  const run: TargetsRun = {
    scale: 0.5,
    rows: TARGETS.map((t, i) => ({
      target: t.id,
      subject: `subject-${i}`,
      battles: 100 + i,
      point: t.id === 'fight-length' ? 6.5 : 0.5,
      interval: t.pointOnly ? null : [0.45, 0.55],
      verdict: i % 3 === 0 ? 'pass' : i % 3 === 1 ? 'fail' : 'inconclusive',
    })),
    measurements: [{ name: 'round-robin', targets: ['vs-field'], battles: 380, ms: 2500 }],
  };
  const report = targetsReport(run, { date: '2026-01-02', args: ['--seeds-scale', '0.5'], wallMs: 3000 });
  const md = renderMarkdown(report);

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
  it('summarises each target once with its band and overall verdict', () => {
    for (const t of TARGETS) expect(md).toContain(`| ${t.name} | ${t.bandText} |`);
  });
  it('records the engine version, the seed scale, and wall time per command and per measurement', () => {
    expect(md).toContain(`${ENGINE_VERSION}`);
    expect(md).toContain('- seeds scale: 0.5');
    expect(md).toContain('- wall time: 3.0 s');
    expect(md).toContain('| round-robin | vs-field | 380 | 2.5 s |');
  });
  it('writes one CSV row per target row with the raw numbers', () => {
    expect(report.csv.columns).toEqual(['target', 'subject', 'battles', 'point', 'interval_lo', 'interval_hi', 'band_lo', 'band_hi', 'verdict']);
    expect(report.csv.rows).toHaveLength(TARGETS.length);
    const fight = report.csv.rows.find((r) => r[0] === 'fight-length');
    expect(fight?.slice(3, 9)).toEqual([6.5, '', '', 5, 8, run.rows.find((r) => r.target === 'fight-length')?.verdict]);
  });
});
