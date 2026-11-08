import type { BattleView, ViewCreature } from '../cards/model.js';
import { moveDef } from '../content/moves.js';
import { STAGE_MAX, type NonPassiveEffect, type Who } from '../content/primitives.js';
import type { WastefulRule } from './model.js';

// Wasteful actions (Ruling 104): whether the action a fired card takes in an Eval Suite scenario is wasted. Each
// rule reads the move's effect primitives — never a list of move ids — and the creatures those effects land on in
// the scenario view. A rule applies to the move's base effect list: a scenario view carries no temperature, so a
// Wild list is never read. A move copy (Episodic Replay, Stochastic Repeat) has no effect of these kinds itself,
// so no rule flags it.

/**
 * The living view creatures `who` names for an action by the view's actor aimed at canonical index `target`
 * (as battle/effects/context.ts `recipients` does for a battle): `allAllies` is the actor's side, actor included.
 */
function recipients(view: BattleView, who: Who, target: number): ViewCreature[] {
  const allied = [view.self, ...view.allies];
  const named = (): ViewCreature[] => {
    switch (who) {
      case 'target':
        return [...allied, ...view.foes].filter((c) => c.index === target);
      case 'self':
        return [view.self];
      case 'allAllies':
        return allied;
      case 'allFoes':
        return [...view.foes];
      case 'everyone':
        return [...allied, ...view.foes];
    }
  };
  return named().filter((c) => c.hp > 0);
}

/** Whether effect `e` is of the kind `rule` judges: a heal, a stage raise, a cure, or a Drift or Junk removal. */
function judged(rule: WastefulRule['kind'], e: NonPassiveEffect): boolean {
  switch (rule) {
    case 'healAtFull':
      return e.kind === 'heal';
    case 'buffAtMax':
      return e.kind === 'stage' && e.op === 'add' && e.delta > 0;
    case 'cureWithoutStatus':
      return e.kind === 'cure';
    case 'compactWhenEmpty':
      return (e.kind === 'cure' && e.statuses.includes('drift')) || (e.kind === 'tokens' && (e.op === 'compact' || e.op === 'clear' || e.op === 'freeOldest'));
  }
}

/** Whether a judged effect `e` would do nothing to creature `c` under `rule`. */
function idleOn(rule: WastefulRule['kind'], e: NonPassiveEffect, c: ViewCreature): boolean {
  switch (rule) {
    case 'healAtFull':
      return c.hp >= c.maxHp;
    case 'buffAtMax':
      return e.kind === 'stage' && e.op === 'add' && c.stages[e.stat] >= STAGE_MAX;
    case 'cureWithoutStatus':
      return e.kind === 'cure' && !e.statuses.some((s) => c.statuses.includes(s));
    case 'compactWhenEmpty':
      // the ruling's test: the creature holds neither Drift nor Junk, whichever of the two the effect removes
      return !c.statuses.includes('drift') && c.junk === 0;
  }
}

/**
 * Whether `rule` flags `moveId` aimed at `target` in `view`: the move has at least one effect of the kind the rule
 * judges, and every such effect would do nothing to every living creature it lands on.
 */
export function isWasteful(rule: WastefulRule, moveId: string, target: number, view: BattleView): boolean {
  const def = moveDef(moveId);
  if (def === null) return false;
  const effects = def.effects.filter((e) => judged(rule.kind, e));
  return effects.length > 0 && effects.every((e) => recipients(view, e.who, target).every((c) => idleOn(rule.kind, e, c)));
}

/** Whether any of a scenario's rules flags the action. */
export function wasted(rules: readonly WastefulRule[], moveId: string, target: number, view: BattleView): boolean {
  return rules.some((r) => isWasteful(r, moveId, target, view));
}
