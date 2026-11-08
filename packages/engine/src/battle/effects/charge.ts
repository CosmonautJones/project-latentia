import type { NonPassiveEffect } from '../../content/primitives.js';
import { creature, type EffectContext } from './context.js';

export type ChargeEffect = Extract<NonPassiveEffect, { kind: 'charge' }>;

/** A move whose effect list charges first (Deliberate, Deep Research). */
export function chargesFirst(effects: readonly NonPassiveEffect[]): boolean {
  return effects.some((e) => e.kind === 'charge');
}

/** What a release resolves: the move's effect list without its `charge` effect. */
export function releaseEffects(effects: readonly NonPassiveEffect[]): NonPassiveEffect[] {
  return effects.filter((e) => e.kind !== 'charge');
}

/**
 * `charge` (Ruling 13): the charge round. The resolver has already paid the move's cost and rolls no
 * accuracy; this records the charge on the user — its target, `rounds` entries to wait, and the power delta
 * a hit while charging will set — and a telegraphed move announces it with Revealed { what: 'telegraph' }.
 * The user's later entries are driven by the charge: while `remaining` is above 0 after counting one down
 * they are skipped ('charging'); at 0 the move is released (see resolveAction).
 */
export function applyCharge(ctx: EffectContext, effect: ChargeEffect): void {
  const user = creature(ctx, ctx.actor);
  user.charging = { moveId: ctx.move.id, target: ctx.target, remaining: effect.rounds, powerDelta: 0, hitPower: effect.hitWhileChargingPower };
  if (effect.telegraphed) ctx.events.push({ round: ctx.round, type: 'Revealed', actor: user.index, target: ctx.target, what: 'telegraph' });
}
