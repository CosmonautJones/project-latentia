import { lo } from '../rng/draws.js';
import { moveMultiplierBp } from './conditions.js';
import type { BattleView, TargetSelector, ViewCreature } from './model.js';

// Target selectors (spec §5): `resolveTarget(sel, view, moveId)` picks a canonical index among the view's living
// on-field creatures, or null when the selector has none. Whether the pick is legal for the move's target kind
// (and normalizing self/none moves to the actor) is the deck evaluator's job (evaluate.ts).

const living = (cs: readonly ViewCreature[]): ViewCreature[] => cs.filter((c) => c.hp > 0).sort((x, y) => x.index - y.index);

/** The first creature (canonical order) with the best `score`; null when there is none. */
function best(cs: readonly ViewCreature[], score: (c: ViewCreature) => number): number | null {
  let pick: { index: number; score: number } | null = null;
  for (const c of living(cs)) {
    const s = score(c);
    if (pick === null || s > pick.score) pick = { index: c.index, score: s };
  }
  return pick?.index ?? null;
}

/** The canonical index the selector names, before the membership check. */
function pick(sel: TargetSelector, view: BattleView, moveId: string): number | null {
  switch (sel) {
    case 'self':
      return view.self.index;
    case 'orchestrator':
      return view.orchestrator?.index ?? null;
    case 'orchestratorTarget':
      return view.orchestratorTarget;
    case 'lowestHpAlly':
      return best([view.self, ...view.allies], (c) => -c.hp);
    case 'lowestHpFoe':
      return best(view.foes, (c) => -c.hp);
    case 'foeWeakToMove':
      return best(view.foes, (c) => moveMultiplierBp(moveId, c));
    case 'highestAtkFoe':
      return best(view.foes, (c) => c.compute);
    case 'randomFoe': {
      const foes = living(view.foes);
      if (view.roundStart === null || foes.length === 0) return null;
      return foes[lo(view.roundStart.r2, foes.length)]?.index ?? null;
    }
  }
}

/**
 * - `self`: the actor; `orchestrator`: the allied orchestrator; `orchestratorTarget`: the view's orchestrator target.
 * - `lowestHpAlly`: lowest HP among the actor and its allies; `lowestHpFoe`: lowest HP among foes (absolute HP,
 *   as the default intent uses).
 * - `foeWeakToMove`: the highest chart multiplier of `moveId` (typeless: neutral for all); `highestAtkFoe`: the
 *   highest effective Compute.
 * - `randomFoe`: foes in canonical order at lo(R2, count), from the actor's round-start draws (null without them).
 * Every tie goes to the lowest canonical index. Every pick is checked to be a living member of the view (the
 * actor, an ally or a foe; Ruling 85), so a stale `orchestratorTarget` or a KO'd creature is never returned.
 */
export function resolveTarget(sel: TargetSelector, view: BattleView, moveId: string): number | null {
  const t = pick(sel, view, moveId);
  return t !== null && [view.self, ...view.allies, ...view.foes].some((c) => c.index === t && c.hp > 0) ? t : null;
}
