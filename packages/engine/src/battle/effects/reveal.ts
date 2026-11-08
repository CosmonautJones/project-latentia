import type { NonPassiveEffect } from '../../content/primitives.js';
import { recipients, type EffectContext } from './context.js';
import { startField } from './timedField.js';

export type RevealEffect = Extract<NonPassiveEffect, { kind: 'reveal' }>;

/**
 * `reveal` (Socratic Method, Stack Trace, Red Team): a timed reveal on every living recipient, kept in
 * BattleState.fields like a timed field — `nextIntent` as `revealIntents` (the same field Saliency Map
 * starts), `topDeckCard` as `revealTopDeckCard`. Revealed is emitted now and after planning at the start of
 * each later round it lasts (`rounds` end-of-round ticks, this round included).
 */
export function applyReveal(ctx: EffectContext, effect: RevealEffect): void {
  const field = effect.what === 'nextIntent' ? ({ kind: 'revealIntents' } as const) : ({ kind: 'revealTopDeckCard' } as const);
  for (const c of recipients(ctx, effect.who)) startField(ctx.state, ctx.actor, c, field, effect.rounds, ctx.events);
}
