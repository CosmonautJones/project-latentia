import { intFlag, positionals, UsageError } from '../args.js';
import { ARCHETYPES, mirrorOf } from '../archetypes/index.js';
import { fmtCount, fmtInterval, fmtPct, fmtSeconds, writeReport, type Report } from '../report.js';
import { runMatch, scoreA } from '../runner.js';
import { median, rate, wilson95 } from '../stats.js';
import type { Archetype, CommandContext, MatchStats } from '../types.js';

// `pnpm sim matchup <a> <b> --seeds N` (spec §9): one pairing, `a` on side a for all N battles (seeded
// `seedFor(matchup:<a>:<b>, i)`), with a round-length histogram. `a` = `b` plays the archetype against its mirror.

/** One bucket per round count from the shortest battle to the longest; the counts sum to the battle count. */
export function histogram(rounds: readonly number[]): [number, number][] {
  if (rounds.length === 0) return [];
  const lo = Math.min(...rounds);
  const hi = Math.max(...rounds);
  const counts = new Array<number>(hi - lo + 1).fill(0);
  for (const r of rounds) counts[r - lo] = (counts[r - lo] ?? 0) + 1;
  return counts.map((n, i): [number, number] => [lo + i, n]);
}

function archetypeById(id: string): Archetype {
  const a = ARCHETYPES.find((x) => x.id === id);
  if (a === undefined) throw new UsageError(`unknown archetype ${id}; known: ${ARCHETYPES.map((x) => x.id).join(', ')}`);
  return a;
}

export function matchupReport(aId: string, bId: string, stats: MatchStats, run: { date: string; args: readonly string[]; wallMs: number }): Report {
  const s = scoreA(stats);
  const buckets = histogram(stats.rounds);
  const widest = Math.max(1, ...buckets.map(([, n]) => n));
  const bLabel = aId === bId ? `${bId} (mirror)` : bId;
  return {
    command: 'matchup',
    date: run.date,
    args: run.args,
    meta: [
      ['seeds', `${fmtCount(s.n)} battles, ${aId} on side a`],
      ['wall time', fmtSeconds(run.wallMs)],
    ],
    sections: [
      {
        heading: 'Result',
        text: ['Side a’s score counts a draw as 0.5; the interval is the 95% Wilson interval.'],
        table: {
          columns: ['side a', 'side b', 'battles', 'a wins', 'b wins', 'draws', 'a score', '95% interval', 'median rounds'],
          rows: [[aId, bLabel, s.n, stats.winsA, stats.winsB, stats.draws, fmtPct(rate(s)), fmtInterval(wilson95(s.points, s.n)), median(stats.rounds)]],
        },
      },
      {
        heading: 'Round-length histogram',
        table: { columns: ['rounds', 'battles', ''], rows: buckets.map(([r, n]) => [r, n, '#'.repeat(Math.round((40 * n) / widest))]) },
      },
    ],
    csv: { columns: ['rounds', 'battles'], rows: buckets },
  };
}

export async function matchupCommand(args: string[], ctx: CommandContext): Promise<number> {
  const ids = positionals(args);
  if (ids.length !== 2) throw new UsageError('usage: matchup <a> <b> --seeds N');
  const [aId, bId] = ids as [string, string];
  const a = archetypeById(aId);
  const b0 = archetypeById(bId);
  const seeds = intFlag(args, 'seeds', 1000);
  const t0 = ctx.now();
  const stats = runMatch(a, a === b0 ? mirrorOf(b0, 'm') : b0, seeds, `matchup:${aId}:${bId}`);
  const paths = writeReport(matchupReport(aId, bId, stats, { date: ctx.date, args, wallMs: ctx.now() - t0 }), ctx.outDir);
  ctx.progress(`wrote ${paths.md} and ${paths.csv}`);
  return 0;
}
