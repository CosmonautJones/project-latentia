import { moveDef } from '../content/moves.js';
import { typeMultiplierBp } from '../content/types.js';
import { assertSafe } from '../math/bp.js';
import { hi } from '../rng/draws.js';
import type { BattleView, Card, Condition, Threshold, ViewCreature } from './model.js';

// Condition evaluation (spec §5): `holds(card, view)` decides whether a card's condition is true for the actor
// the view was built for. It reads the view only and never looks at whether the card's move is usable.

const NEUTRAL_BP = 10000;

/** `value / max` against `pct` percent by cross-multiplication: below is `value × 100 < max × pct`, atLeast is `≥`. */
export function meets(t: Threshold, value: number, max: number): boolean {
  const lhs = assertSafe(value * 100, 'threshold value');
  const rhs = assertSafe(max * t.pct, 'threshold max');
  return t.op === 'below' ? lhs < rhs : lhs >= rhs;
}

/** The card move's chart multiplier against `c` (bp); a typeless or unknown move is neutral. */
export function moveMultiplierBp(moveId: string, c: ViewCreature): number {
  const def = moveDef(moveId);
  return def === null || def.type === 'system' ? NEUTRAL_BP : typeMultiplierBp(def.type, c.types);
}

/** The creatures a subject category reads: the living actor, the living allied orchestrator, or every living on-field foe. */
function subjects(card: Card, view: BattleView): readonly ViewCreature[] {
  switch (card.subject) {
    case 'self':
      return view.self.hp > 0 ? [view.self] : [];
    case 'orchestrator':
      return view.orchestrator !== null && view.orchestrator.hp > 0 ? [view.orchestrator] : [];
    case 'foe':
      return view.foes.filter((f) => f.hp > 0);
  }
}

/** A subject category's test on one creature. */
function matches(card: Card, cond: Exclude<Condition, { category: 'turn' | 'cooldown' | 'allyHp' | 'coin' }>, c: ViewCreature): boolean {
  switch (cond.category) {
    case 'hp':
      return meets(cond, c.hp, c.maxHp);
    case 'status':
      return c.statuses.includes(cond.status);
    case 'foeType':
      return cond.is === 'weakToMove' ? moveMultiplierBp(card.move, c) > NEUTRAL_BP : c.types.includes(cond.is);
    case 'foeLastMove':
      return c.lastMove === cond.move;
    case 'field':
      return c.fields.includes(cond.effect);
    case 'foeBuffed':
      return Object.values(c.stages).some((s) => s > 0);
    case 'contextFill':
      return meets(cond, c.contextUsed, c.contextWindow);
    case 'telegraphing':
      return c.telegraphing;
  }
}

/** Whether the card's condition holds in `view` (see Condition for each category's definition). */
export function holds(card: Card, view: BattleView): boolean {
  const cond = card.condition;
  switch (cond.category) {
    case 'turn':
      return cond.op === 'below' ? view.round < cond.round : view.round >= cond.round;
    case 'cooldown': {
      const last = view.selfLastUsed.find((u) => u.moveId === card.move);
      return last === undefined || last.round < view.round - cond.rounds;
    }
    case 'allyHp':
      return view.allies.some((a) => a.hp > 0 && meets(cond, a.hp, a.maxHp));
    case 'coin':
      return view.roundStart !== null && hi(view.roundStart.r1, 2) === 1;
    default:
      return subjects(card, view).some((c) => matches(card, cond, c));
  }
}
