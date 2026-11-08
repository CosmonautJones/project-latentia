import { numFlag } from '../args.js';
import { fmtCount, fmtInterval, fmtPct, fmtSeconds, writeReport, type Report } from '../report.js';
import { GRAFT_SPECIES, GRAFT_STARTER } from '../target-setups.js';
import { measureTargets, TARGETS, targetById, targetVerdict, type TargetRow, type TargetsRun } from '../targets.js';
import type { CommandContext } from '../types.js';

// `pnpm sim targets [--seeds-scale k]` (spec §9, Ruling 133): every balance target, each with its own setup, at k × its
// §9 seed count. A failing target is a balance finding, not an error: the exit code is 0.

const fmtPoint = (r: TargetRow): string => (r.target === 'fight-length' ? String(r.point) : fmtPct(r.point));

export function targetsReport(run: TargetsRun, cli: { date: string; args: readonly string[]; wallMs: number }): Report {
  const battles = run.measurements.reduce((n, m) => n + m.battles, 0);
  return {
    command: 'targets',
    date: cli.date,
    args: cli.args,
    meta: [
      ['seeds scale', String(run.scale)],
      ['battles', fmtCount(battles)],
      ['wall time', fmtSeconds(cli.wallMs)],
    ],
    sections: [
      {
        heading: 'Targets',
        text: [
          'A target passes when its point estimate and its whole 95% Wilson interval lie inside the band, fails when the point is outside, and is inconclusive when the point is inside but the interval crosses an edge; a draw counts 0.5 (spec §9). Fight length is judged on its point alone. A target with several rows takes its worst row’s verdict.',
        ],
        table: {
          columns: ['target', 'band', 'seeds (§9)', 'rows', 'pass', 'inconclusive', 'fail', 'verdict'],
          rows: TARGETS.map((t) => {
            const vs = run.rows.filter((r) => r.target === t.id).map((r) => r.verdict);
            const count = (v: string) => vs.filter((x) => x === v).length;
            return [t.name, t.bandText, t.seeds, vs.length, count('pass'), count('inconclusive'), count('fail'), vs.length === 0 ? 'not measured' : targetVerdict(vs)];
          }),
        },
      },
      {
        heading: 'Verdicts',
        text: [
          `Starter triangle: each starter at L8 on its standard grid with Tokenibble L8, vs the starter it beats; the favoured side's score. Temperature dial: the T0 side's score. Graft vs spin-up: ${GRAFT_STARTER} at L8 with ${GRAFT_SPECIES.join(', ')} grafted (G) or spun up (S); G's score. First mover: side A's score over every archetype against its mirror. Worst matchup: each archetype's worst pairing (its score, both orderings pooled), then the overall worst.`,
        ],
        table: {
          columns: ['target', 'subject', 'battles', 'point', '95% interval', 'verdict'],
          rows: run.rows.map((r) => [targetById(r.target).name, r.subject, r.battles, fmtPoint(r), r.interval === null ? 'point only' : fmtInterval(r.interval), r.verdict]),
        },
      },
      {
        heading: 'Timings',
        table: { columns: ['measurement', 'targets', 'battles', 'wall time'], rows: run.measurements.map((m) => [m.name, m.targets.join(', '), m.battles, fmtSeconds(m.ms)]) },
      },
    ],
    csv: {
      columns: ['target', 'subject', 'battles', 'point', 'interval_lo', 'interval_hi', 'band_lo', 'band_hi', 'verdict'],
      rows: run.rows.map((r) => {
        const band = targetById(r.target).band;
        return [r.target, r.subject, r.battles, r.point, r.interval?.[0] ?? '', r.interval?.[1] ?? '', band[0], band[1], r.verdict];
      }),
    },
  };
}

export async function targetsCommand(args: string[], ctx: CommandContext): Promise<number> {
  const scale = numFlag(args, 'seeds-scale', 1);
  const t0 = ctx.now();
  const run = measureTargets({ scale, now: ctx.now, progress: ctx.progress });
  const paths = writeReport(targetsReport(run, { date: ctx.date, args, wallMs: ctx.now() - t0 }), ctx.outDir);
  ctx.progress(`wrote ${paths.md} and ${paths.csv}`);
  return 0;
}
