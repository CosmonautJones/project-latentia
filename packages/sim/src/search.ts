import { validateSetup, type Deck, type SeedHex } from '@latentia/engine';
import { drawCandidate, mutationPools } from './mutations.js';
import { runPooled } from './runner.js';
import { Sfc32 } from './sfc32.js';
import { addScores, rate } from './stats.js';
import type { Archetype, Score } from './types.js';

// The budgeted deck search (spec §9, Task C4, Ruling 139): hill climbing over an archetype's Autopilot deck, hunting
// for a dominant deck before players find one. Each step draws one valid mutation (mutations.ts) and keeps it only
// when it scores at least ACCEPT_MARGIN (1 pp) higher (Ruling 141). Every deck is scored with common random numbers: the same field, the same seeds —
// k per foe per side, both side assignments, through runMatch so opponentId is set — so a score difference is the
// deck's, not the dice's. The search stops before an evaluation would take it past `budget` battles.

/** Seeds per foe per side by default: against the 19-archetype field one evaluation is 19 × 2 × 16 = 608 battles, so a 20,000 budget gives 32 evaluations. */
export const DEFAULT_K = 16;
/** Invalid or no-op draws allowed per step before the search gives up (they cost no battles). */
export const MAX_REDRAWS = 100;
/**
 * How much a candidate must beat the incumbent by, as a score rate on the shared seeds (Ruling 141): 0.01 = 1
 * percentage point. One evaluation's standard error is about 1.9 pp at k = 16, so a bare "strictly higher" rule
 * chases noise.
 */
export const ACCEPT_MARGIN = 0.01;

/** One evaluated deck: the base (evaluation 0) or a candidate, its score, whether it was kept, and battles spent so far. */
export type Trial = { evaluation: number; mutation: string; score: number; accepted: boolean; battlesUsed: number };

export type SearchResult = {
  /** The best deck found (the base deck when no step was accepted). */
  deck: Deck;
  /** Its score rate on the search seeds (a draw counts 0.5). */
  winRate: number;
  battlesUsed: number;
  /** The base deck's score, then each accepted step's: each at least ACCEPT_MARGIN above the one before. */
  history: number[];
  k: number;
  battlesPerEvaluation: number;
  evaluations: number;
  /** Every evaluation in order, the base first. */
  trials: Trial[];
  /** `budget`: the next evaluation would exceed the budget; `redraws`: no valid mutation within the redraw cap. */
  stop: 'budget' | 'redraws';
};

export type SearchOptions = {
  /** Seeds per foe per side (DEFAULT_K). */
  k?: number;
  /** Redraws allowed per step (MAX_REDRAWS). */
  maxRedraws?: number;
  /** Called after each evaluation (for progress lines), with how many evaluations the budget allows. */
  onTrial?: (t: Trial, maxEvaluations: number) => void;
};

/** The seedFor label family of the search seeds, and of the held-out seeds no search ever sees. */
export const searchLabel = (id: string): string => `search:${id}`;
export const heldOutLabel = (id: string): string => `search-heldout:${id}`;

/** A new archetype: `base` with its Autopilot deck replaced (same id, team, grid and temperature). ARCHETYPES stay frozen and untouched. */
export function withDeck(base: Archetype, deck: Deck): Archetype {
  const auto = base.side.autopilot;
  if (auto === undefined) throw new RangeError(`${base.id} has no Autopilot deck`);
  return { id: base.id, side: { ...base.side, autopilot: { deck, temperature: auto.temperature } } };
}

/** `x`'s Score over `field`: per foe, k battles on each side (labels `<label>:<foe id>:ab` and `:ba`). */
export function evaluate(x: Archetype, field: readonly Archetype[], k: number, label: string): Score {
  return addScores(...field.map((foe) => runPooled(x, foe, k, `${label}:${foe.id}`).score));
}

/** `x`'s Score over `field` on fresh seeds (the overfitting guard, Ruling 139 f): the same shape as a search evaluation, another label. */
export function heldOut(x: Archetype, field: readonly Archetype[], k: number): Score {
  return evaluate(x, field, k, heldOutLabel(x.id));
}

/** Whether `deck` is a valid Autopilot deck for `base`: validateSetup reports nothing on its side, facing `foe` (Ruling 125). */
function validator(base: Archetype, foe: Archetype): (deck: Deck) => boolean {
  return (deck) => {
    const side = { ...withDeck(base, deck).side, opponentId: foe.id };
    const r = validateSetup({ a: side, b: { ...foe.side, opponentId: base.id }, kind: 'trainer' });
    return r.errors.every((e) => !e.path.startsWith('a.'));
  };
}

/**
 * Hill climbing from `base`'s Autopilot deck against `field` (archetypes other than `base`), for at most `budget`
 * battles, the base deck's evaluation included. `seed` drives the mutation draws only: the same seed gives the same
 * deck, history and battlesUsed. Throws a RangeError when `base` has no valid Autopilot deck, `field` is empty or holds
 * `base`, or the budget is below one evaluation.
 */
export function searchDeck(base: Archetype, field: readonly Archetype[], budget: number, seed: SeedHex, opts: SearchOptions = {}): SearchResult {
  const k = opts.k ?? DEFAULT_K;
  const maxRedraws = opts.maxRedraws ?? MAX_REDRAWS;
  const baseDeck = base.side.autopilot?.deck;
  const foe = field[0];
  if (baseDeck === undefined) throw new RangeError(`${base.id} has no Autopilot deck`);
  if (foe === undefined) throw new RangeError('the field is empty');
  if (field.some((f) => f.id === base.id)) throw new RangeError(`the field holds ${base.id} itself`);
  if (!(Number.isSafeInteger(k) && k >= 1)) throw new RangeError(`k must be a positive integer, got ${k}`);
  const perEval = field.length * 2 * k;
  if (!(budget >= perEval)) throw new RangeError(`budget ${budget} is below one evaluation (${perEval} battles)`);
  const isValid = validator(base, foe);
  if (!isValid(baseDeck)) throw new RangeError(`${base.id}'s Autopilot deck fails validateSetup`);

  const rng = new Sfc32(seed);
  const pools = mutationPools(base, field);
  const label = searchLabel(base.id);
  const maxEvaluations = Math.floor(budget / perEval);
  let deck = baseDeck;
  let best = evaluate(base, field, k, label);
  let battlesUsed = perEval;
  const history = [rate(best)];
  const trials: Trial[] = [{ evaluation: 0, mutation: 'base deck', score: rate(best), accepted: true, battlesUsed }];
  opts.onTrial?.(trials[0] as Trial, maxEvaluations);
  let stop: SearchResult['stop'] = 'budget';
  while (battlesUsed + perEval <= budget) {
    const evaluation = trials.length;
    const m = drawCandidate(deck, pools, rng, `search-${evaluation}`, isValid, maxRedraws);
    if (m === null) {
      stop = 'redraws';
      break;
    }
    const score = evaluate(withDeck(base, m.deck), field, k, label);
    battlesUsed += perEval;
    // At least ACCEPT_MARGIN higher (same seeds, same n, so compare points: margin × n of them).
    const accepted = score.points - best.points >= ACCEPT_MARGIN * perEval;
    if (accepted) {
      deck = m.deck;
      best = score;
      history.push(rate(score));
    }
    const t: Trial = { evaluation, mutation: m.label, score: rate(score), accepted, battlesUsed };
    trials.push(t);
    opts.onTrial?.(t, maxEvaluations);
  }
  return { deck, winRate: rate(best), battlesUsed, history, k, battlesPerEvaluation: perEval, evaluations: trials.length, trials, stop };
}
