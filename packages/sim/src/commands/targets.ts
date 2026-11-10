import { activeCardCount, type CreatureSetup } from '@latentia/engine';
import { num, parseArgs, tag, type CommandSpec } from '../args.js';
import { ARCHETYPES } from '../archetypes/index.js';
import { fmtCount, fmtInterval, fmtPct, fmtSeconds, writeReport, type Report } from '../report.js';
import { baseTeam, GRAFT_SPECIES, graftVariant, spinUpVariant, starterSide, TRIANGLE } from '../target-setups.js';
import { measureTargets, TARGETS, targetById, targetVerdict, TEMPERATURE_SWEEP_PER_SIDE, type TargetRow, type TargetsRun } from '../targets.js';
import type { CommandContext } from '../types.js';

// `pnpm sim targets [--seeds-scale k]` (spec §9, Ruling 133): every balance target, each with its own setup, at k × its
// §9 seed count. A failing target is a balance finding, not an error: the exit code is 0. Diagnostic rows and the
// summary row are shown with their band reading but never counted (Ruling 143).

export const TARGETS_COMMAND: CommandSpec = { name: 'targets', positionals: [], flags: { 'seeds-scale': 'num', tag: 'tag' } };

const fmtPoint = (r: TargetRow): string => (r.target === 'fight-length' ? String(r.point) : fmtPct(r.point));

const team = (cs: readonly CreatureSetup[]): string => cs.map((c) => `${c.species} L${c.level}`).join(' + ');

/** A row's verdict cell: a target row's verdict; a summary or diagnostic row's band reading, labelled as not counted. */
export const verdictCell = (r: TargetRow): string =>
  r.role === 'target' ? r.verdict : r.role === 'summary' ? `${r.verdict} (summary: repeats a row above, not counted)` : `diagnostic (reads ${r.verdict} against the band; not counted)`;

/** What each setup is, read off the setup objects themselves (Ruling 137 m6), so the prose cannot drift from them. */
export function setupNotes(): string[] {
  const triangle = TRIANGLE.map(([fav, beaten]) => {
    const f = starterSide(fav).side;
    const b = starterSide(beaten).side;
    return `${fav} L${f.orchestrator.level} alone vs ${beaten} L${b.orchestrator.level} alone`;
  });
  const base = baseTeam().side;
  const graft = GRAFT_SPECIES.map((sp) => {
    const g = graftVariant(sp).side;
    const s = spinUpVariant(sp).side;
    const spun = s.active.find((c) => c.species === sp);
    const piece = g.grid?.pieces.find((p) => p.kind === 'graft');
    const slot = s.grid?.pieces.find((p) => p.kind === 'subagentSlot' && p.subagentId === spun?.id);
    const active = s.grid === null || slot === undefined || spun === undefined ? 0 : activeCardCount(s.grid, slot.id, spun.version);
    return `${sp}: G = base team + graft ${piece?.moveId} (${piece?.shape.length} cells); S = base team + ${sp} L${spun?.level} spun up with moves ${spun?.moves.join(', ')} (no signature) on ${active} active card${active === 1 ? '' : 's'}`;
  });
  return [
    `- Starter triangle (favoured side's score, Ruling 146): ${triangle.join('; ')}; orchestrator only on the role-based Autopilot deck, each on its standard grid with the Subagent Slot left empty.`,
    `- Temperature dial (T0 side's score): each of the ${ARCHETYPES.length} archetypes at Autopilot T0 vs its own mirror at T4, both sides, pooled (Ruling 143). Diagnostic rows: the same pairing per archetype, ${fmtCount(TEMPERATURE_SWEEP_PER_SIDE)} battles per side assignment at scale 1, on its own seeds.`,
    `- Graft worth taking (the graft side's score, Ruling 147): the base team (${base.orchestrator.species} L${base.orchestrator.level} + ${team(base.active)}) plus a graft against the same base team without it, for each of ${GRAFT_SPECIES.join(', ')}. Diagnostic rows: that graft team (G) against the same base team with the species spun up instead (S). Spin-up is intended to be the stronger choice, so those rows are expected to read low; a freshly spun-up subagent joins at the defeated wild model's level (Ruling 145) with 1 active Example Card (Ruling 147). ${graft.join('; ')}.`,
    `- First mover: ${ARCHETYPES.length} archetypes, each against its mirror, side A's score pooled.`,
    `- Vs field, worst matchup and fight length: one round-robin of the ${ARCHETYPES.length} archetypes; worst matchup lists each archetype's worst pairing (its score, both orderings pooled), then the overall worst as a summary row.`,
  ];
}

export function targetsReport(run: TargetsRun, cli: { date: string; tag?: string | undefined; args: readonly string[]; wallMs: number }): Report {
  const battles = run.measurements.reduce((n, m) => n + m.battles, 0);
  return {
    command: 'targets',
    date: cli.date,
    tag: cli.tag,
    args: cli.args,
    seedScale: { value: String(run.scale), unit: '--seeds-scale: the multiple of each §9 seed count' },
    meta: [
      ['battles', fmtCount(battles)],
      ['wall time', fmtSeconds(cli.wallMs)],
    ],
    sections: [
      {
        heading: 'Targets',
        text: [
          'A target passes when its point estimate and its whole 95% Wilson interval lie inside the band, fails when the point is outside, and is inconclusive when the point is inside but the interval crosses an edge; a draw counts 0.5 (spec §9). Fight length is judged on its point alone. A target with several rows takes its worst row’s verdict.',
          'Only target rows are counted. A summary row repeats a target row (worst matchup’s overall worst), and a diagnostic row is a reading against the band that is never counted (Ruling 143). “Seeds run” is what this run actually played at its seed scale.',
        ],
        table: {
          columns: ['target', 'band', 'seeds (§9)', 'seeds run', 'rows', 'pass', 'inconclusive', 'fail', 'not counted', 'verdict'],
          rows: TARGETS.map((t) => {
            const all = run.rows.filter((r) => r.target === t.id);
            const vs = all.filter((r) => r.role === 'target').map((r) => r.verdict);
            const count = (v: string) => vs.filter((x) => x === v).length;
            return [t.name, t.bandText, t.seeds, run.seeds[t.id], vs.length, count('pass'), count('inconclusive'), count('fail'), all.length - vs.length, vs.length === 0 ? 'not measured' : targetVerdict(vs)];
          }),
        },
      },
      {
        heading: 'Verdicts',
        text: setupNotes(),
        table: {
          columns: ['target', 'subject', 'battles', 'point', '95% interval', 'verdict'],
          rows: run.rows.map((r) => [targetById(r.target).name, r.subject, r.battles, fmtPoint(r), r.interval === null ? 'point only' : fmtInterval(r.interval), verdictCell(r)]),
        },
      },
      {
        heading: 'Timings',
        table: { columns: ['measurement', 'targets', 'battles', 'wall time'], rows: run.measurements.map((m) => [m.name, m.targets.join(', '), m.battles, fmtSeconds(m.ms)]) },
      },
    ],
    csv: {
      // role: target (counted), summary or diagnostic (not counted); verdict is the row's band reading either way.
      columns: ['target', 'role', 'subject', 'battles', 'point', 'interval_lo', 'interval_hi', 'band_lo', 'band_hi', 'verdict'],
      rows: run.rows.map((r) => {
        const band = targetById(r.target).band;
        return [r.target, r.role, r.subject, r.battles, r.point, r.interval?.[0] ?? '', r.interval?.[1] ?? '', band[0], band[1], r.verdict];
      }),
    },
  };
}

export async function targetsCommand(args: string[], ctx: CommandContext): Promise<number> {
  const p = parseArgs(args, TARGETS_COMMAND);
  const scale = num(p, 'seeds-scale', 1);
  const t0 = ctx.now();
  const run = measureTargets({ scale, now: ctx.now, progress: ctx.progress });
  const paths = writeReport(targetsReport(run, { date: ctx.date, tag: tag(p, 'tag'), args, wallMs: ctx.now() - t0 }), ctx);
  ctx.progress(`wrote ${paths.md} and ${paths.csv}`);
  return 0;
}
