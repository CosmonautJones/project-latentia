import { flag, num, parseArgs, tag, UsageError, type CommandSpec } from '../args.js';
import { ARCHETYPES, mirrorOf } from '../archetypes/index.js';
import { fmtCount, fmtInterval, fmtPct, fmtSeconds, writeReport, type Report } from '../report.js';
import { runMatch, scoreA, scoreB } from '../runner.js';
import { addScores, median, rate, wilson95 } from '../stats.js';
import type { Archetype, CommandContext, MatchStats, Score } from '../types.js';

// `pnpm sim matchup <a> <b> --seeds N [--one-sided]` (spec §9, Ruling 143): one pairing with both side assignments
// pooled, as the round-robin and the targets score a pairing: N battles with `a` on side a (seeded
// `seedFor(matchup:<a>:<b>:ab, i)`) and N with it on side b (`…:ba`), 2N in all. `--one-sided` runs only the N
// battles with `a` on side a, seeded `seedFor(matchup:<a>:<b>, i)`. Either way the report has a round-length
// histogram. `a` = `b` plays the archetype against its mirror.

export const MATCHUP: CommandSpec = { name: 'matchup', positionals: ['a', 'b'], flags: { seeds: 'int', 'one-sided': 'bool', tag: 'tag' } };

/** One bucket per round count from the shortest battle to the longest; the counts sum to the battle count. */
export function histogram(rounds: readonly number[]): [number, number][] {
  if (rounds.length === 0) return [];
  // A loop, not Math.min(...rounds): spreading a large array overflows the argument list.
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rounds) {
    if (r < lo) lo = r;
    if (r > hi) hi = r;
  }
  const counts = new Array<number>(hi - lo + 1).fill(0);
  for (const r of rounds) counts[r - lo] = (counts[r - lo] ?? 0) + 1;
  return counts.map((n, i): [number, number] => [lo + i, n]);
}

/** The archetype with id `id`; a UsageError naming the known ids otherwise. */
export function archetypeById(id: string): Archetype {
  const a = ARCHETYPES.find((x) => x.id === id);
  if (a === undefined) throw new UsageError(`unknown archetype ${id}; known: ${ARCHETYPES.map((x) => x.id).join(', ')}`);
  return a;
}

/** A matchup's runs from `a`'s point of view: `ab` with `a` on side a, and (pooled, the default) `ba` with it on side b. */
export type MatchupRuns = { ab: MatchStats; ba: MatchStats | null };

/** The matchup's battles: `seeds` per side assignment, or only `a` on side a when `oneSided`. */
export function runMatchup(a: Archetype, b: Archetype, seeds: number, label: string, oneSided: boolean): MatchupRuns {
  if (oneSided) return { ab: runMatch(a, b, seeds, label), ba: null };
  return { ab: runMatch(a, b, seeds, `${label}:ab`), ba: runMatch(b, a, seeds, `${label}:ba`) };
}

export function matchupReport(aId: string, bId: string, runs: MatchupRuns, run: { date: string; tag?: string | undefined; args: readonly string[]; wallMs: number }): Report {
  const bLabel = aId === bId ? `${bId} (mirror)` : bId;
  // Each line from a's point of view: a's wins, b's wins, draws, a's score.
  const line = (side: string, s: MatchStats, aWins: number, bWins: number, score: Score) => [side, aId, bLabel, score.n, aWins, bWins, s.draws, fmtPct(rate(score)), fmtInterval(wilson95(score.points, score.n)), median(s.rounds)];
  const rows = [line('a', runs.ab, runs.ab.winsA, runs.ab.winsB, scoreA(runs.ab))];
  const rounds = [...runs.ab.rounds, ...(runs.ba?.rounds ?? [])];
  if (runs.ba !== null) {
    const pooled = addScores(scoreA(runs.ab), scoreB(runs.ba));
    const both: MatchStats = { winsA: runs.ab.winsA + runs.ba.winsB, winsB: runs.ab.winsB + runs.ba.winsA, draws: runs.ab.draws + runs.ba.draws, rounds, capHits: runs.ab.capHits + runs.ba.capHits };
    rows.push(line('b', runs.ba, runs.ba.winsB, runs.ba.winsA, scoreB(runs.ba)), line('both (pooled)', both, both.winsA, both.winsB, pooled));
  }
  const total = rounds.length;
  const buckets = histogram(rounds);
  const widest = buckets.reduce((w, [, n]) => (n > w ? n : w), 1);
  const perSide = runs.ab.winsA + runs.ab.winsB + runs.ab.draws;
  return {
    command: 'matchup',
    date: run.date,
    tag: run.tag,
    args: run.args,
    seedScale: { value: String(perSide), unit: runs.ba === null ? `seeds, ${aId} on side a only (--one-sided)` : 'seeds per side assignment' },
    meta: [
      ['seeds', runs.ba === null ? `${fmtCount(total)} battles, ${aId} on side a (--one-sided)` : `${fmtCount(total)} battles: ${fmtCount(perSide)} with ${aId} on each side, pooled`],
      ['wall time', fmtSeconds(run.wallMs)],
    ],
    sections: [
      {
        heading: 'Result',
        text: [`Every line is ${aId}’s point of view: its wins, ${bLabel}’s wins, and ${aId}’s score (a draw counts 0.5) with its 95% Wilson interval. “${aId} side” is the side it played.`],
        table: { columns: [`${aId} side`, 'archetype', 'opponent', 'battles', 'wins', 'losses', 'draws', 'score', '95% interval', 'median rounds'], rows },
      },
      {
        heading: 'Round-length histogram',
        text: runs.ba === null ? [] : ['Both side assignments together.'],
        table: { columns: ['rounds', 'battles', ''], rows: buckets.map(([r, n]) => [r, n, '#'.repeat(Math.round((40 * n) / widest))]) },
      },
    ],
    csv: { columns: ['rounds', 'battles'], rows: buckets },
  };
}

export async function matchupCommand(args: string[], ctx: CommandContext): Promise<number> {
  const p = parseArgs(args, MATCHUP);
  const [aId, bId] = p.positionals as [string, string];
  const a = archetypeById(aId);
  const b0 = archetypeById(bId);
  const seeds = num(p, 'seeds', 1000);
  const t0 = ctx.now();
  const runs = runMatchup(a, a === b0 ? mirrorOf(b0, 'm') : b0, seeds, `matchup:${aId}:${bId}`, flag(p, 'one-sided'));
  const paths = writeReport(matchupReport(aId, bId, runs, { date: ctx.date, tag: tag(p, 'tag'), args, wallMs: ctx.now() - t0 }), ctx);
  ctx.progress(`wrote ${paths.md} and ${paths.csv}`);
  return 0;
}
