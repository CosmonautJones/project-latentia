import type { BattleView, ViewCreature } from '../cards/model.js';
import { moveDef } from '../content/moves.js';
import { STAGE_MAX, STAGE_MIN, STAGE_STATS, type MoveDef, type NonPassiveEffect, type Who } from '../content/primitives.js';
import type { WastefulRule } from './model.js';

// Wasteful actions (Ruling 106, amending 104): whether the action a fired card takes in an Eval Suite scenario is
// wasted. An action is wasted only when the WHOLE action achieves nothing in the scenario view: the move deals no
// damage and every one of its effects is a no-op on every creature it lands on, judged from the move's effect
// primitives — never a list of move ids. An effect this module cannot prove idle from the view (damage, a status
// infliction, a field, a guard, a snapshot, a copy, …) counts as doing something. The four rule kinds are labels: a
// scenario lists the kinds it traps, and a rule flags a no-op action whose move holds an effect of its kind. A rule
// reads the move's base effect list: a scenario view carries no temperature, so a Wild list is never read.

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

/** Whether effect `e` is of the kind `rule` labels: a heal, a stage raise, a cure, or a Drift or token removal. */
function labels(rule: WastefulRule['kind'], e: NonPassiveEffect): boolean {
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

/** The creatures on the other side from `c` (its foes when it is the actor or the actor's ally). */
function opponentsOf(view: BattleView, c: ViewCreature): readonly ViewCreature[] {
  return [view.self, ...view.allies].some((a) => a.index === c.index) ? view.foes : [view.self, ...view.allies];
}

/** Whether effect `e` would change nothing for creature `c`, as far as the view shows; false when that cannot be shown. */
function noOpOn(view: BattleView, e: NonPassiveEffect, c: ViewCreature): boolean {
  switch (e.kind) {
    case 'heal':
      return c.hp >= c.maxHp;
    case 'stage':
      if (e.op === 'clear') return STAGE_STATS.every((s) => (e.which === 'all' ? c.stages[s] === 0 : c.stages[s] <= 0));
      return e.delta > 0 ? c.stages[e.stat] >= STAGE_MAX : e.delta < 0 ? c.stages[e.stat] <= STAGE_MIN : true;
    case 'cure':
      return !e.statuses.some((s) => c.statuses.includes(s));
    case 'tokens':
      // A pending costSet / costAdd makes the move pay cells first, which a token op may then remove (Ruling 111 m2).
      if (view.pendingCost.length > 0) return false;
      // Compact pairs the oldest tokens into summaries (context/compaction.ts): with fewer than two it pairs nothing
      if (e.op === 'compact') return c.contextUsed < 2;
      // /clear's clearAll also removes Drift (context/store.ts; Ruling 111 m1)
      if (e.op === 'clear') return c.contextUsed === 0 && !c.statuses.includes('drift');
      if (e.op === 'freeOldest') return c.contextUsed === 0;
      return false;
    case 'nextActionModifier':
      // a skipped orchestrator command is a no-op for a subagent (content/primitives.ts NextActionMod `skip`)
      if (e.modifier.kind === 'skip') return !c.isOrchestrator;
      if (e.modifier.kind === 'ignoreEvasion') return opponentsOf(view, c).every((o) => o.stages.evasion <= 0);
      return false;
    default:
      return false;
  }
}

/**
 * Whether move `def` aimed at `target` achieves nothing at all in `view`: it has no power (a move with power always
 * deals damage, whatever its effect list says), and every effect is a no-op on every creature it lands on.
 */
export function isNoOpMove(def: MoveDef, target: number, view: BattleView): boolean {
  return def.power === null && def.effects.every((e) => recipients(view, e.who, target).every((c) => noOpOn(view, e, c)));
}

/** Whether `moveId` aimed at `target` would achieve nothing at all in `view`, whatever its kind (false for an unknown move). */
export function isNoOp(moveId: string, target: number, view: BattleView): boolean {
  const def = moveDef(moveId);
  return def !== null && isNoOpMove(def, target, view);
}

/**
 * Whether `rule` flags `moveId` aimed at `target` in `view`: the whole action is a no-op and the move holds at least
 * one effect of the kind the rule labels.
 */
export function isWasteful(rule: WastefulRule, moveId: string, target: number, view: BattleView): boolean {
  const def = moveDef(moveId);
  return def !== null && def.effects.some((e) => labels(rule.kind, e)) && isNoOpMove(def, target, view);
}

/** The first of a scenario's rules that flags the action — the reason it is wasted — or null when none does. */
export function wasteReason(rules: readonly WastefulRule[], moveId: string, target: number, view: BattleView): WastefulRule['kind'] | null {
  return rules.find((r) => isWasteful(r, moveId, target, view))?.kind ?? null;
}
