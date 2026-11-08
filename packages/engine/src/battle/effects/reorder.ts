import type { NonPassiveEffect } from '../../content/primitives.js';
import { recipients, type EffectContext } from './context.js';

export type TurnOrderEffect = Extract<NonPassiveEffect, { kind: 'reorder'; what: 'turnOrder' }>;

/**
 * `reorder turnOrder` (Rerank): the user hands its turn to the target. The user's entry is the one resolving
 * now, so the target's pending entry (if it has not resolved yet this round) moves to the front of
 * BattleState.turnOrder and resolves right after this action; the rest keep their sorted order. Every entry
 * still resolves exactly once and draws its six draws when it does. A target with no pending entry (it
 * already acted, or has none) is unaffected.
 */
export function applyReorder(ctx: EffectContext, effect: TurnOrderEffect): void {
  const order = ctx.state.turnOrder;
  for (const c of recipients(ctx, effect.who)) {
    const at = order.indexOf(c.index);
    if (at < 0 || c.index === ctx.actor) continue;
    order.splice(at, 1);
    order.unshift(c.index);
  }
}
