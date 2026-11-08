import type { NonPassiveEffect, StageStat } from '../../content/primitives.js';
import type { CreatureState } from '../state.js';
import { creature, recipients, type EffectContext } from './context.js';
import { changeStage, STAGE_STATS } from './stage.js';

export type StealStageEffect = Extract<NonPassiveEffect, { kind: 'stealStage' }>;

/** The creature's highest positive stage, ties in STAGE_STATS order; null without one. */
export function highestPositive(c: CreatureState): StageStat | null {
  let best: StageStat | null = null;
  for (const stat of STAGE_STATS) if ((c.stages[stat] ?? 0) > (best === null ? 0 : (c.stages[best] ?? 0))) best = stat;
  return best;
}

/**
 * `stealStage` (Scrapion's Scrape): min(`stages`, that stage) leaves the living target's highest positive
 * stage and goes to the user (its own stage still clamps at +3). Emits StageStolen { amount: what the target
 * lost }, then the target's and the user's StageChanged.
 */
export function applyStealStage(ctx: EffectContext, effect: StealStageEffect): void {
  const user = creature(ctx, ctx.actor);
  for (const target of recipients(ctx, effect.who)) {
    const stat = highestPositive(target);
    if (stat === null || target.index === user.index) continue;
    const amount = Math.min(effect.stages, target.stages[stat] ?? 0);
    ctx.events.push({ round: ctx.round, type: 'StageStolen', actor: user.index, target: target.index, stat, amount });
    changeStage(target, stat, -amount, ctx.round, ctx.events);
    changeStage(user, stat, amount, ctx.round, ctx.events);
  }
}
