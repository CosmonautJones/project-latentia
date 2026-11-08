import type { Deck } from '@latentia/engine';
import { num, parseArgs, str, tag, UsageError, type CommandSpec } from '../args.js';
import { ARCHETYPES } from '../archetypes/index.js';
import { deckTable } from '../card-text.js';
import { fmtCount, fmtInterval, fmtPct, fmtSeconds, writeReport, type Report } from '../report.js';
import { seedFor } from '../runner.js';
import { ACCEPT_MARGIN, DEFAULT_K, heldOut, MAX_REDRAWS, searchDeck, withDeck, type SearchResult } from '../search.js';
import { rate, wilson95 } from '../stats.js';
import type { Archetype, CommandContext, Score } from '../types.js';
import { archetypeById } from './matchup.js';

// `pnpm sim search --archetype <id> --budget N [--seed <hex>] [--tag <tag>]` (Task C4, Ruling 139 g): hill-climb the
// archetype's Autopilot deck against the other 19 archetypes within N battles, then score the base and final decks on
// held-out seeds. Without --seed the search seed is seedFor(search-seed:<id>, 0).

export const SEARCH: CommandSpec = { name: 'search', positionals: [], flags: { archetype: 'id', budget: 'int', seed: 'seed', tag: 'tag' }, required: ['archetype', 'budget'] };

type HeldOut = { base: Score; final: Score; baseSearch: number };

export function searchReport(
  base: Archetype,
  r: SearchResult,
  held: HeldOut,
  run: { date: string; tag?: string | undefined; args: readonly string[]; wallMs: number; budget: number; seed: string; foes: number },
): Report {
  const accepted = r.trials.slice(1).filter((t) => t.accepted).length;
  const marginText = `${(100 * ACCEPT_MARGIN).toFixed(1)} pp`;
  const heldRow = (name: string, search: number, s: Score) => [name, fmtPct(search), fmtPct(rate(s)), fmtInterval(wilson95(s.points, s.n)), `${(100 * (search - rate(s))).toFixed(1)} pp`];
  return {
    command: 'search',
    date: run.date,
    tag: run.tag,
    args: run.args,
    meta: [
      ['archetype', base.id],
      ['seed', run.seed],
      ['k', `${r.k} seed${r.k === 1 ? '' : 's'} per foe per side (${run.foes} foes × 2 sides × ${r.k} = ${r.battlesPerEvaluation} battles per evaluation)`],
      ['battlesUsed', `${r.battlesUsed} of ${run.budget} (unused: ${run.budget - r.battlesUsed})`],
      ['acceptance margin', `${marginText} on the search seeds`],
      ['evaluations', `${r.evaluations} (the base deck and ${r.evaluations - 1} candidates; ${accepted} accepted)`],
      ['stopped', r.stop === 'budget' ? 'the next evaluation would exceed the budget' : `no valid mutation in ${MAX_REDRAWS + 1} draws`],
      ['held-out battles', `${fmtCount(held.base.n + held.final.n)} (outside the budget: base and final deck, ${fmtCount(held.base.n)} each)`],
      ['wall time', `${fmtSeconds(run.wallMs)} (search and held-out check)`],
    ],
    sections: [
      {
        heading: 'Score history',
        text: [
          `Every deck is scored on the same seeds against the same field (common random numbers); a draw counts 0.5. A candidate is kept only when it scores at least ${marginText} higher than the incumbent.`,
          `Accepted steps: ${r.history.map(fmtPct).join(' → ')}.`,
        ],
        table: { columns: ['evaluation', 'mutation', 'score', 'kept', 'best', 'battles used'], rows: bestRows(r).map((x) => [x.evaluation, x.mutation, fmtPct(x.score), x.accepted ? 'yes' : 'no', fmtPct(x.best), x.battlesUsed]) },
      },
      { heading: 'Final deck', text: ['Read top to bottom: the first card whose condition holds and whose move fits fires.'], table: deckTable(r.deck) },
      { heading: 'Base deck', table: deckTable(base.side.autopilot?.deck as Deck) },
      {
        heading: 'Held-out check',
        text: [
          `The overfitting guard: each deck re-scored on fresh seeds (seedFor label search-heldout:${base.id}, never seen by the search), the same field and k. The gap is search score minus held-out score.`,
        ],
        table: { columns: ['deck', 'search score', 'held-out score', 'held-out 95% interval', 'gap'], rows: [heldRow('base', held.baseSearch, held.base), heldRow('final', r.winRate, held.final)] },
      },
    ],
    csv: {
      columns: ['evaluation', 'mutation', 'score', 'accepted', 'best', 'battles_used'],
      rows: bestRows(r).map((x) => [x.evaluation, x.mutation, x.score, x.accepted ? 'yes' : 'no', x.best, x.battlesUsed]),
    },
  };
}

/** The trials with the best score so far after each. */
function bestRows(r: SearchResult) {
  let best = -Infinity;
  return r.trials.map((t) => {
    if (t.accepted) best = t.score;
    return { ...t, best };
  });
}

export async function searchCommand(args: string[], ctx: CommandContext, opts: { k?: number } = {}): Promise<number> {
  const p = parseArgs(args, SEARCH);
  const base = archetypeById(str(p, 'archetype') as string);
  const budget = num(p, 'budget', 0);
  const k = opts.k ?? DEFAULT_K;
  const field = ARCHETYPES.filter((a) => a.id !== base.id);
  const perEval = field.length * 2 * k;
  if (budget < perEval) throw new UsageError(`--budget ${budget} is below one evaluation: ${perEval} battles (${field.length} foes × 2 sides × k ${k})`);
  const seed = str(p, 'seed') ?? seedFor(`search-seed:${base.id}`, 0);
  const t0 = ctx.now();
  const r = searchDeck(base, field, budget, seed, {
    k,
    onTrial: (t, max) => ctx.progress(`search: evaluation ${t.evaluation + 1}/${max} ${fmtPct(t.score)}${t.accepted ? ' kept' : ''} (${t.mutation})`),
  });
  const held: HeldOut = { base: heldOut(base, field, k), final: heldOut(withDeck(base, r.deck), field, k), baseSearch: r.history[0] as number };
  const report = searchReport(base, r, held, { date: ctx.date, tag: tag(p, 'tag'), args, wallMs: ctx.now() - t0, budget, seed, foes: field.length });
  const paths = writeReport(report, ctx.outDir);
  ctx.progress(`wrote ${paths.md} and ${paths.csv}`);
  return 0;
}
