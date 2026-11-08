import { activeCardCount, ENGINE_VERSION, type CreatureSetup } from '@latentia/engine';
import { num, parseArgs, tag, type CommandSpec } from '../args.js';
import { ARCHETYPES } from '../archetypes/index.js';
import { fmtCount, fmtInterval, fmtPct, fmtSeconds, writeReport, type Report } from '../report.js';
import { GRAFT_SPECIES, graftVariant, spinUpVariant, starterSide, temperatureSides, TRIANGLE } from '../target-setups.js';
import { measureTargets, TARGETS, targetById, targetVerdict, type TargetRow, type TargetsRun } from '../targets.js';
import type { CommandContext } from '../types.js';

// `pnpm sim targets [--seeds-scale k]` (spec §9, Ruling 133): every balance target, each with its own setup, at k × its
// §9 seed count. A failing target is a balance finding, not an error: the exit code is 0.

export const TARGETS_COMMAND: CommandSpec = { name: 'targets', positionals: [], flags: { 'seeds-scale': 'num', tag: 'tag' } };

const fmtPoint = (r: TargetRow): string => (r.target === 'fight-length' ? String(r.point) : fmtPct(r.point));

const team = (cs: readonly CreatureSetup[]): string => cs.map((c) => `${c.species} L${c.level}`).join(' + ');

/** What each setup is, read off the setup objects themselves (Ruling 137 m6), so the prose cannot drift from them. */
export function setupNotes(): string[] {
  const triangle = TRIANGLE.map(([fav, beaten]) => {
    const f = starterSide(fav).side;
    const b = starterSide(beaten).side;
    return `${fav} L${f.orchestrator.level} + ${team(f.active)} vs ${beaten} L${b.orchestrator.level} + ${team(b.active)}`;
  });
  const [t0, t4] = temperatureSides();
  const graft = GRAFT_SPECIES.map((sp) => {
    const g = graftVariant(sp).side;
    const s = spinUpVariant(sp).side;
    const piece = g.grid?.pieces.find((p) => p.kind === 'graft');
    const slot = s.grid?.pieces.find((p) => p.kind === 'subagentSlot' && p.subagentId === s.active.find((c) => c.species === sp)?.id);
    const active = s.grid === null || slot === undefined ? 0 : activeCardCount(s.grid, slot.id, s.active.find((c) => c.species === sp)?.version ?? 'v2');
    const species = (cs: readonly CreatureSetup[]) => cs.map((c) => c.species).join(' + ');
    return `${sp}: G = ${g.orchestrator.species} + ${species(g.active)} with graft ${piece?.moveId} (${piece?.shape.length} cells); S = ${s.orchestrator.species} + ${species(s.active)}, ${sp} on ${active} active cards`;
  });
  return [
    `- Starter triangle (favoured side's score): ${triangle.join('; ')}.`,
    `- Temperature dial (T0 side's score): ${t0.id} at Autopilot T${t0.side.autopilot?.temperature} vs its mirror at T${t4.side.autopilot?.temperature}.`,
    `- Graft vs spin-up (G's score): ${graft.join('; ')}.`,
    `- First mover: ${ARCHETYPES.length} archetypes, each against its mirror, side A's score pooled.`,
    `- Vs field, worst matchup and fight length: one round-robin of the ${ARCHETYPES.length} archetypes; worst matchup lists each archetype's worst pairing (its score, both orderings pooled), then the overall worst.`,
  ];
}

export function targetsReport(run: TargetsRun, cli: { date: string; tag?: string | undefined; args: readonly string[]; wallMs: number }): Report {
  const battles = run.measurements.reduce((n, m) => n + m.battles, 0);
  return {
    command: 'targets',
    date: cli.date,
    tag: cli.tag,
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
        text: setupNotes(),
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
      columns: ['target', 'subject', 'battles', 'point', 'interval_lo', 'interval_hi', 'band_lo', 'band_hi', 'verdict', 'seeds_scale', 'engine_version'],
      rows: run.rows.map((r) => {
        const band = targetById(r.target).band;
        return [r.target, r.subject, r.battles, r.point, r.interval?.[0] ?? '', r.interval?.[1] ?? '', band[0], band[1], r.verdict, run.scale, ENGINE_VERSION];
      }),
    },
  };
}

export async function targetsCommand(args: string[], ctx: CommandContext): Promise<number> {
  const p = parseArgs(args, TARGETS_COMMAND);
  const scale = num(p, 'seeds-scale', 1);
  const t0 = ctx.now();
  const run = measureTargets({ scale, now: ctx.now, progress: ctx.progress });
  const paths = writeReport(targetsReport(run, { date: ctx.date, tag: tag(p, 'tag'), args, wallMs: ctx.now() - t0 }), ctx.outDir);
  ctx.progress(`wrote ${paths.md} and ${paths.csv}`);
  return 0;
}
