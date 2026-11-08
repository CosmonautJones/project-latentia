import type { BattleView } from '../cards/model.js';
import type { Band } from '../cards/evaluate.js';

// Eval Suite data and the Generalization report (spec §5 "Generalization"; bible "Generalization makes
// overfitting legible"). Plain JSON-compatible data: suites are authored as frozen literals.

/**
 * A "wasteful action" rule a scenario applies to the action its fired card takes (Ruling 104):
 * - `healAtFull`: the move heals and every creature it heals is at full HP;
 * - `buffAtMax`: every stage the move raises, on every creature it raises it on, is already +3;
 * - `cureWithoutStatus`: the move cures and no creature it cures holds any status it cures;
 * - `compactWhenEmpty`: the move removes Drift or Junk and no creature it does that for holds either.
 */
export type WastefulRule = { readonly kind: 'healAtFull' | 'buffAtMax' | 'cureWithoutStatus' | 'compactWhenEmpty' };

/** One held-out ("Unseen") scenario: a read-only battle view and the wasteful rules that apply in it. */
export type EvalScenario = { readonly id: string; readonly view: BattleView; readonly wasteful: readonly WastefulRule[] };

/** A region's Eval Suite: exactly EVAL_SUITE_SIZE scenarios. */
export type EvalSuite = { readonly id: string; readonly scenarios: readonly EvalScenario[] };

export const EVAL_SUITE_SIZE = 12;

/**
 * C (Coverage), R (Redundancy) and H (Holdout) as exact [numerator, denominator] pairs in lowest terms with a
 * positive denominator (zero is [0, 1]); G in 0…100 and its band.
 */
export type GeneralizationReport = { c: [number, number]; r: [number, number]; h: [number, number]; g: number; band: Band };
