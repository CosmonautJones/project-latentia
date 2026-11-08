import { num, parseArgs, tag, type CommandSpec } from '../args.js';
import { ARCHETYPES } from '../archetypes/index.js';
import { fmtCount, fmtInterval, fmtPct, fmtSeconds, writeReport, type Report } from '../report.js';
import { allRounds, fieldScore, roundRobin, totalCapHits, unorderedPairings, worstPairing, type RoundRobin } from '../round-robin.js';
import { scoreA } from '../runner.js';
import { median, rate, wilson95 } from '../stats.js';
import type { CommandContext } from '../types.js';

// `pnpm sim round-robin --seeds 1000` (spec §9): every archetype against every other, both side assignments, in one
// process, with a progress line per archetype on stderr.

export const ROUND_ROBIN: CommandSpec = { name: 'round-robin', positionals: [], flags: { seeds: 'int', tag: 'tag' } };

export function roundRobinReport(rr: RoundRobin, run: { date: string; tag?: string | undefined; args: readonly string[]; wallMs: number }): Report {
  const rounds = allRounds(rr);
  const sorted = [...rounds].sort((x, y) => x - y);
  const q = (p: number): number => sorted[Math.floor(p * (sorted.length - 1))] ?? NaN;
  const field = rr.ids
    .map((id) => ({ id, score: fieldScore(rr, id), worst: worstPairing(rr, id) }))
    .sort((a, b) => rate(b.score) - rate(a.score) || (a.id < b.id ? -1 : 1));
  const seedText = `${fmtCount(rr.seeds)} seed${rr.seeds === 1 ? '' : 's'} per ordered pairing`;
  return {
    command: 'round-robin',
    date: run.date,
    tag: run.tag,
    args: run.args,
    meta: [
      ['seeds', seedText],
      ['pairings', `${rr.ids.length} archetypes → ${unorderedPairings(rr).length} unordered pairings → ${rr.ordered.length} ordered pairings`],
      ['battles', fmtCount(rounds.length)],
      ['wall time', fmtSeconds(run.wallMs)],
    ],
    sections: [
      {
        heading: 'Fight length',
        text: [`Median ${median(rounds)} rounds; p25 ${q(0.25)}, p75 ${q(0.75)}, min ${sorted[0]}, max ${sorted.at(-1)}; round-cap hits (BattleEnd reason cap) ${totalCapHits(rr)}.`],
      },
      {
        heading: 'Vs the field',
        text: ['Each archetype’s score over all of its battles (a draw counts 0.5), with its 95% Wilson interval, and the pairing (both orderings pooled) it scores worst in.'],
        table: {
          columns: ['archetype', 'battles', 'score', '95% interval', 'worst pairing', 'score there'],
          rows: field.map((f) => [f.id, f.score.n, fmtPct(rate(f.score)), fmtInterval(wilson95(f.score.points, f.score.n)), f.worst.foe, fmtPct(rate(f.worst.score))]),
        },
      },
    ],
    csv: {
      columns: ['a', 'b', 'battles', 'wins_a', 'wins_b', 'draws', 'score_a', 'median_rounds'],
      rows: rr.ordered.map((p) => {
        const s = scoreA(p.stats);
        return [p.a, p.b, s.n, p.stats.winsA, p.stats.winsB, p.stats.draws, rate(s), median(p.stats.rounds)];
      }),
    },
  };
}

export async function roundRobinCommand(args: string[], ctx: CommandContext): Promise<number> {
  const p = parseArgs(args, ROUND_ROBIN);
  const seeds = num(p, 'seeds', 1000);
  const t0 = ctx.now();
  const rr = roundRobin(ARCHETYPES, seeds, 'round-robin', (done, total) => ctx.progress(`round-robin: ${done}/${total} archetypes`));
  const paths = writeReport(roundRobinReport(rr, { date: ctx.date, tag: tag(p, 'tag'), args, wallMs: ctx.now() - t0 }), ctx.outDir);
  ctx.progress(`wrote ${paths.md} and ${paths.csv}`);
  return 0;
}
