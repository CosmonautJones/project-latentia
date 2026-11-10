import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_VERSION } from '@latentia/engine';

// The report writer (spec §9): every command writes `<outDir>/<command>-<date>.md` and a `.csv` beside it. The date,
// the output directory and the git revision come from the CLI layer (Ruling 126), so the writer itself reads no clock
// and runs no git. Every report records its provenance (Ruling 143 I5): the engine version, the seed scale, the content
// fingerprint and the git SHA with a dirty flag — in the md header, and as the last columns of every CSV row.

export type Cell = string | number;
export type Table = { columns: readonly string[]; rows: readonly (readonly Cell[])[] };
export type Section = { heading: string; text?: readonly string[]; table?: Table };

/** The checked-out commit and whether the work tree differed from it outside reports/; null when git was unavailable. */
export type GitRevision = { sha: string; dirty: boolean } | null;
/** Where a report's numbers came from, beyond the engine version: the content fingerprint (fingerprint.ts) and the git revision. */
export type Provenance = { fingerprint: string; git: GitRevision };

/**
 * A command's report. `meta` lines (label, value) follow the engine version and the command line at the top: seed
 * counts and wall times go there. `csv` is the machine-readable table written to the `.csv`.
 */
export type Report = {
  command: string;
  date: string;
  /** Appended to the file names (`--tag`): `<command>-<date>-<tag>`. */
  tag?: string | undefined;
  args: readonly string[];
  /** The run's seed scale: `value` goes in the CSV's seed_scale column, `unit` says what it counts (`--seeds-scale`, seeds per ordered pairing…). */
  seedScale: { value: string; unit: string };
  meta: readonly (readonly [string, string])[];
  sections: readonly Section[];
  csv: Table;
};

const mdCell = (c: Cell): string => String(c).replace(/\|/g, '\\|');

function mdTable(t: Table): string[] {
  return [`| ${t.columns.map(mdCell).join(' | ')} |`, `|${t.columns.map(() => '---').join('|')}|`, ...t.rows.map((r) => `| ${r.map(mdCell).join(' | ')} |`)];
}

const gitText = (g: GitRevision): string => (g === null ? 'unknown (git unavailable)' : `${g.sha} (${g.dirty ? 'dirty: the work tree differed from it outside reports/' : 'clean'})`);

export function renderMarkdown(r: Report, p: Provenance): string {
  const out = [
    `# ${r.command} — ${r.date}`,
    '',
    `- engine: \`@latentia/engine\` ${ENGINE_VERSION}`,
    `- command: \`${['pnpm sim', r.command, ...r.args].join(' ')}\``,
    `- seed scale: ${r.seedScale.value} (${r.seedScale.unit})`,
    `- content fingerprint: ${p.fingerprint} (FNV-1a 64 of the canonical JSON of ARCHETYPES and the target setups)`,
    `- git: ${gitText(p.git)}`,
    ...r.meta.map(([k, v]) => `- ${k}: ${v}`),
  ];
  for (const s of r.sections) {
    out.push('', `## ${s.heading}`);
    if (s.text !== undefined && s.text.length > 0) out.push('', ...s.text);
    if (s.table !== undefined) out.push('', ...mdTable(s.table));
  }
  return `${out.join('\n')}\n`;
}

const csvCell = (c: Cell): string => {
  const s = String(c);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function renderCsv(t: Table): string {
  return [t.columns, ...t.rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** The provenance columns every CSV ends with. */
export const PROVENANCE_COLUMNS = ['engine_version', 'seed_scale', 'content_fingerprint', 'git_sha', 'git_dirty'] as const;

/** `t` with the provenance columns appended to its header and to every row. */
export function withProvenance(t: Table, r: Pick<Report, 'seedScale'>, p: Provenance): Table {
  const cells: Cell[] = [ENGINE_VERSION, r.seedScale.value, p.fingerprint, p.git?.sha ?? 'unknown', p.git === null ? 'unknown' : String(p.git.dirty)];
  return { columns: [...t.columns, ...PROVENANCE_COLUMNS], rows: t.rows.map((row) => [...row, ...cells]) };
}

/**
 * Writes the report's `.md` and `.csv` into `outDir` (created when missing; same-day files are overwritten), both
 * carrying `provenance`, and returns their paths.
 */
export function writeReport(r: Report, ctx: { outDir: string; provenance: Provenance }): { md: string; csv: string } {
  mkdirSync(ctx.outDir, { recursive: true });
  const base = join(ctx.outDir, `${r.command}-${r.date}${r.tag === undefined ? '' : `-${r.tag}`}`);
  const paths = { md: `${base}.md`, csv: `${base}.csv` };
  writeFileSync(paths.md, renderMarkdown(r, ctx.provenance));
  writeFileSync(paths.csv, renderCsv(withProvenance(r.csv, r, ctx.provenance)));
  return paths;
}

/** A rate as a percentage with one decimal. */
export const fmtPct = (x: number): string => `${(100 * x).toFixed(1)}%`;
export const fmtInterval = ([lo, hi]: readonly [number, number]): string => `[${fmtPct(lo)}, ${fmtPct(hi)}]`;
/** Milliseconds as seconds with one decimal. */
export const fmtSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;
/** An integer with thousands separators (1,000), independent of the host locale. */
export const fmtCount = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
