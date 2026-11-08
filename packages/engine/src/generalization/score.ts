import { bandFor, evaluateDeck } from '../cards/evaluate.js';
import type { Card, Deck } from '../cards/model.js';
import { assertSafe, EngineInvariantError, idiv } from '../math/bp.js';
import { ratio, roundHalfUp } from '../math/rational.js';
import { EVAL_SUITE_SIZE, type EvalScenario, type EvalSuite, type GeneralizationReport } from './model.js';
import { wasted } from './wasteful.js';

// Generalization G (spec §5 "Generalization", Rulings 103–104): a pure function of a deck, an Eval Suite and the
// creature's active slots. It evaluates the suite's snapshots with the deck evaluator and never runs a battle; G
// is a setup input the caller computes and passes in.

/** Coverage counts at most this many categories (spec: distinct categories ÷ min(activeSlots, 6)). */
const COVERAGE_SLOTS = 6;
/** G = round_half_up(35·C + 45·H + 20·(1 − R)): the spec's weights 0.35 / 0.45 / 0.20 times 100. */
const WEIGHT = { c: 35, h: 45, r: 20 } as const;

/** The deck's active non-Default cards: the first min(activeSlots, cards) (Ruling 103). The Default card is never one. */
function activeCards(deck: Deck, activeSlots: number): readonly Card[] {
  return deck.cards.slice(0, Math.min(activeSlots, deck.cards.length));
}

/** C = min(1, distinct condition categories ÷ min(activeSlots, 6)); 0 with no active slot. */
function coverage(active: readonly Card[], activeSlots: number): [number, number] {
  const slots = Math.min(activeSlots, COVERAGE_SLOTS);
  if (slots === 0) return [0, 1];
  const categories = new Set(active.map((c) => c.condition.category)).size;
  return ratio(Math.min(categories, slots), slots);
}

/** R = card pairs with the same category and the same move ÷ total card pairs; 0 with fewer than 2 cards. */
function redundancy(active: readonly Card[]): [number, number] {
  const n = active.length;
  if (n < 2) return [0, 1];
  let same = 0;
  active.forEach((a, i) => {
    for (const b of active.slice(i + 1)) if (a.condition.category === b.condition.category && a.move === b.move) same += 1;
  });
  return ratio(same, idiv(assertSafe(n * (n - 1), 'card pairs'), 2));
}

/**
 * Whether the scenario is a Holdout hit (Ruling 103): evaluated as a Stable creature with no obedience roll and
 * no policies, a non-Default card fires (not a status fallback) and none of the scenario's wasteful rules flags
 * its move at its resolved target.
 */
export function scenarioHit(deck: Deck, scenario: EvalScenario, activeSlots: number): boolean {
  const e = evaluateDeck(deck, scenario.view, activeSlots, { band: 'stable' });
  if (e.cardId === deck.default.id || e.fallback || e.target === null) return false;
  return !wasted(scenario.wasteful, e.moveId, e.target, scenario.view);
}

/**
 * G and its parts for `deck` with `activeSlots` active cards over `suite` (spec §5): C, R and H as exact fractions
 * in lowest terms, G = round_half_up(100 × (0.35·C + 0.45·H + 0.20·(1 − R))) in integers, and G's band.
 */
export function computeGeneralization(deck: Deck, suite: EvalSuite, activeSlots: number): GeneralizationReport {
  if (!Number.isSafeInteger(activeSlots) || activeSlots < 0) throw new EngineInvariantError(`computeGeneralization: activeSlots must be a non-negative integer, got ${String(activeSlots)}`);
  if (suite.scenarios.length !== EVAL_SUITE_SIZE) throw new EngineInvariantError(`computeGeneralization: suite ${suite.id} has ${suite.scenarios.length} scenarios, not ${EVAL_SUITE_SIZE}`);
  const active = activeCards(deck, activeSlots);
  const c = coverage(active, activeSlots);
  const r = redundancy(active);
  const h = ratio(suite.scenarios.filter((s) => scenarioHit(deck, s, activeSlots)).length, EVAL_SUITE_SIZE);
  // 35·cn/cd + 45·hn/hd + 20·(rd − rn)/rd over the common denominator cd·hd·rd
  const den = assertSafe(c[1] * h[1] * r[1], 'G denominator');
  const num = assertSafe(WEIGHT.c * c[0] * h[1] * r[1] + WEIGHT.h * h[0] * c[1] * r[1] + WEIGHT.r * (r[1] - r[0]) * c[1] * h[1], 'G numerator');
  const g = roundHalfUp(num, den);
  return { c, r, h, g, band: bandFor(g) };
}
