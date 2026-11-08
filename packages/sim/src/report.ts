import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_VERSION } from '@latentia/engine';

// The report writer (spec §9): every command writes `<outDir>/<command>-<date>.md` and a `.csv` beside it. The date
// and the output directory come from the CLI layer (Ruling 126), so the writer itself reads no clock.

export type Cell = string | number;
export type Table = { columns: readonly string[]; rows: readonly (readonly Cell[])[] };
export type Section = { heading: string; text?: readonly string[]; table?: Table };

/**
 * A command's report. `meta` lines (label, value) follow the engine version and the command line at the top: seed
 * counts and wall times go there. `csv` is the machine-readable table written to the `.csv`.
 */
export type Report = { command: string; date: string; args: readonly string[]; meta: readonly (readonly [string, string])[]; sections: readonly Section[]; csv: Table };

const mdCell = (c: Cell): string => String(c).replace(/\|/g, '\\|');

function mdTable(t: Table): string[] {
  return [`| ${t.columns.map(mdCell).join(' | ')} |`, `|${t.columns.map(() => '---').join('|')}|`, ...t.rows.map((r) => `| ${r.map(mdCell).join(' | ')} |`)];
}

export function renderMarkdown(r: Report): string {
  const out = [
    `# ${r.command} — ${r.date}`,
    '',
    `- engine: \`@latentia/engine\` ${ENGINE_VERSION}`,
    `- command: \`${['pnpm sim', r.command, ...r.args].join(' ')}\``,
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

/** Writes the report's `.md` and `.csv` into `outDir` (created when missing) and returns their paths. */
export function writeReport(r: Report, outDir: string): { md: string; csv: string } {
  mkdirSync(outDir, { recursive: true });
  const base = join(outDir, `${r.command}-${r.date}`);
  const paths = { md: `${base}.md`, csv: `${base}.csv` };
  writeFileSync(paths.md, renderMarkdown(r));
  writeFileSync(paths.csv, renderCsv(r.csv));
  return paths;
}

/** A rate as a percentage with one decimal. */
export const fmtPct = (x: number): string => `${(100 * x).toFixed(1)}%`;
export const fmtInterval = ([lo, hi]: readonly [number, number]): string => `[${fmtPct(lo)}, ${fmtPct(hi)}]`;
/** Milliseconds as seconds with one decimal. */
export const fmtSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;
/** An integer with thousands separators (1,000), independent of the host locale. */
export const fmtCount = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
