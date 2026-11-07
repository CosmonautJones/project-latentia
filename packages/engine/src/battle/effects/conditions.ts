import { moveDef } from '../../content/moves.js';
import type { Condition, Counter, MoveDef, PowerBonus } from '../../content/primitives.js';
import { SPECIES } from '../../content/species.js';
import type { TypeId } from '../../content/ids.js';
import { typeMultiplierBp } from '../../content/types.js';
import { assertSafe } from '../../math/bp.js';
import { hasStatus } from '../../status/apply.js';
import type { CreatureState, MoveRecord } from '../state.js';
import { creature, type EffectContext } from './context.js';

/** The species' types; an unknown species id is impossible after setup validation. */
export function typesOf(c: CreatureState): readonly TypeId[] {
  return SPECIES[c.speciesId as keyof typeof SPECIES].types;
}

/** The move's chart multiplier against `defender`, or null for a typeless (`system`) move. */
export function typeBpAgainst(move: MoveDef, defender: CreatureState): number | null {
  return move.type === 'system' ? null : typeMultiplierBp(move.type, typesOf(defender));
}

function recordAt(c: CreatureState, round: number): MoveRecord | undefined {
  return c.moveHistory.find((r) => r.round === round);
}

/** A buff: the move's own effect list raises a stage of its user (alone or with its side). */
function buffs(def: MoveDef): boolean {
  return def.effects.some((e) => e.kind === 'stage' && e.op === 'add' && e.delta > 0 && (e.who === 'self' || e.who === 'allAllies' || e.who === 'everyone'));
}

/**
 * Battle-state tests of conditional effects. History comes from `moveHistory` (resolved moves only):
 * "acted this round" means the target resolved a move this round; "last round" reads its move of round − 1,
 * a status move being one with no power and a buff one whose effects raise its user's stages.
 */
export function holds(ctx: EffectContext, cond: Condition): boolean {
  const user = creature(ctx, ctx.actor);
  const target = creature(ctx, ctx.target);
  switch (cond.kind) {
    case 'targetHasStatus':
      return hasStatus(target, cond.status);
    case 'userHpPctAboveTarget':
      return assertSafe(user.hp * target.maxHp, 'hp% user') > assertSafe(target.hp * user.maxHp, 'hp% target');
    case 'targetWeakToMove':
      return (typeBpAgainst(ctx.move, target) ?? 0) > 10000;
    case 'targetActedThisRound':
      return recordAt(target, ctx.round) !== undefined;
    case 'targetLastRound': {
      const last = recordAt(target, ctx.round - 1);
      const def = last === undefined ? null : moveDef(last.moveId);
      if (def === null) return false;
      return cond.did.some((d) => (d === 'buffed' ? buffs(def) : def.power === null));
    }
  }
}

/** Counters for `perCount` bonuses. */
function count(ctx: EffectContext, counter: Counter): number {
  const user = creature(ctx, ctx.actor);
  switch (counter.kind) {
    case 'userConsecutiveRoundsUsingType': {
      let n = 0;
      for (let r = ctx.round - 1; ; r--) {
        const rec = recordAt(user, r);
        if (rec === undefined || moveDef(rec.moveId)?.type !== counter.type) return n;
        n++;
      }
    }
    case 'hitsTakenFromTarget':
      return creature(ctx, ctx.target).moveHistory.filter((r) => r.damaged.includes(ctx.actor)).length;
  }
}

/** The additive power bonus (spec §5 damage step 1) for a move of base power `base`. */
export function powerBonus(ctx: EffectContext, bonus: PowerBonus | undefined, base: number): number {
  if (bonus === undefined) return 0;
  if (bonus.kind === 'flat') return holds(ctx, bonus.when) ? bonus.add : 0;
  const raw = assertSafe(bonus.per * count(ctx, bonus.counter), 'power bonus');
  const cap = bonus.cap.of === 'bonus' ? bonus.cap.value : bonus.cap.value - base;
  return Math.max(0, Math.min(raw, cap));
}
