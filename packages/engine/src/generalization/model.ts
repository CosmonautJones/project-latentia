import type { BattleView } from '../cards/model.js';
import type { Band } from '../cards/evaluate.js';

// Eval Suite data and the Generalization report (spec §5 "Generalization"; bible "Generalization makes
// overfitting legible"). Plain JSON-compatible data: suites are authored as frozen literals.

/**
 * A "wasteful action" label a scenario traps (Rulings 104, 106). An action is wasted only when the whole action
 * achieves nothing in the view (no damage, every effect a no-op); the label that flags it names the kind of effect
 * that was wasted: `healAtFull` a heal, `buffAtMax` a stage raise, `cureWithoutStatus` a cure, `compactWhenEmpty` a
 * Drift or token removal (generalization/wasteful.ts).
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
