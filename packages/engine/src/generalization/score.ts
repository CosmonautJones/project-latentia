import { deckShapeErrors } from '../cards/deck-shape.js';
import { bandFor, evaluateDeck } from '../cards/evaluate.js';
import type { ShapeError } from '../cards/json.js';
import type { Card, Deck } from '../cards/model.js';
import { assertSafe, idiv } from '../math/bp.js';
import { ratio, roundHalfUp } from '../math/rational.js';
import { GeneralizationError } from './errors.js';
import { EVAL_SUITE_SIZE, type EvalScenario, type EvalSuite, type GeneralizationReport } from './model.js';
import { wasteReason } from './wasteful.js';

// Generalization G (spec §5 "Generalization", Rulings 103, 106 and 107): a pure function of a deck, an Eval Suite and the
// creature's active slots. It evaluates the suite's snapshots with the deck evaluator and never runs a battle; G
// is a setup input the caller computes and passes in.

/** Coverage counts at most this many categories (spec: distinct categories ÷ min(activeSlots, 6)). */
const COVERAGE_SLOTS = 6;
/** G = round_half_up(35·C + 45·H + 20·(1 − R)): the spec's weights 0.35 / 0.45 / 0.20 times 100. */
const WEIGHT = { c: 35, h: 45, r: 20 } as const;
/** The most active cards a creature can have: 8 version slots at v4, a hard cap (bible; grid/adjacency.ts VERSION_SLOTS). */
export const MAX_ACTIVE_SLOTS = 8;

/** Why the deck is malformed (Ruling 107): its shape errors, a missing Default card, or a card id used twice; null when well-formed. */
function deckProblem(deck: unknown): string | null {
  const errors: ShapeError[] = [];
  deckShapeErrors(deck, 'deck', errors);
  if (errors.length > 0) return errors.map((e) => `${e.path}: ${e.message}`).join('; ');
  const d = deck as Deck;
  if (d.default === undefined || d.default === null) return 'deck.default: a deck needs a Default card';
  const ids = [...d.cards, d.default].map((c) => c.id);
  return new Set(ids).size === ids.length ? null : 'deck: every card id, the Default card included, must be unique';
}

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
 * its action as a whole no-op (Ruling 106).
 */
export function scenarioHit(deck: Deck, scenario: EvalScenario, activeSlots: number): boolean {
  const e = evaluateDeck(deck, scenario.view, activeSlots, { band: 'stable' });
  if (e.cardId === deck.default.id || e.fallback || e.target === null) return false;
  return wasteReason(scenario.wasteful, e.moveId, e.target, scenario.view) === null;
}

/**
 * G and its parts for `deck` with `activeSlots` active cards over `suite` (spec §5): C, R and H as exact fractions
 * in lowest terms, G = round_half_up(100 × (0.35·C + 0.45·H + 0.20·(1 − R))) in integers, and G's band. Caller
 * mistakes throw a GeneralizationError (Ruling 107); its messages never print the offending value.
 */
export function computeGeneralization(deck: Deck, suite: EvalSuite, activeSlots: number): GeneralizationReport {
  if (!Number.isInteger(activeSlots) || activeSlots < 0 || activeSlots > MAX_ACTIVE_SLOTS) throw new GeneralizationError('activeSlots', `activeSlots must be an integer in 0..${MAX_ACTIVE_SLOTS}`);
  if (!Array.isArray(suite?.scenarios) || suite.scenarios.length !== EVAL_SUITE_SIZE) throw new GeneralizationError('suiteSize', `a suite holds exactly ${EVAL_SUITE_SIZE} scenarios`);
  const problem = deckProblem(deck);
  if (problem !== null) throw new GeneralizationError('deck', problem);
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
