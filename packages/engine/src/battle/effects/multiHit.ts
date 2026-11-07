import type { HitCount, NonPassiveEffect } from '../../content/primitives.js';
import { hi } from '../../rng/draws.js';
import { onField } from '../order.js';
import { typesOf } from './conditions.js';
import { creature, type EffectContext } from './context.js';
import { announceHit, computeHit, dealDamage, recordHit, takeIncomingBp } from './damage.js';

export type MultiHitEffect = Extract<NonPassiveEffect, { kind: 'multiHit' }>;

/**
 * Hit count: `range` → min + hi(D5, max − min + 1); `perAllyOfType` → base + the user's other living
 * on-field allies whose species has the type.
 */
export function hitCount(ctx: EffectContext, count: HitCount): number {
  if (count.kind === 'range') return count.min + hi(ctx.draws.d5, count.max - count.min + 1);
  const user = creature(ctx, ctx.actor);
  const allies = ctx.state.creatures.filter((c) => c.side === user.side && c.index !== user.index && !c.fainted && onField(ctx.state, c) && typesOf(c).includes(count.type));
  return count.base + allies.length;
}

/**
 * `multiHit` (spec §5 step 7): accuracy (already rolled), crit and roll are shared, so one hit is computed
 * and landed `count` times at the move's per-hit power, stopping when the target faints. Crit and
 * TypeEffect are announced once; the whole move is one Handoff hit and one Efficient Answer check.
 */
export function applyMultiHit(ctx: EffectContext, effect: MultiHitEffect): void {
  const target = creature(ctx, ctx.target);
  if (target.fainted) return;
  const n = hitCount(ctx, effect.count);
  const hit = computeHit(ctx, {}, takeIncomingBp(target));
  announceHit(ctx, hit);
  let removed = 0;
  for (let i = 0; i < n && !target.fainted; i++) removed += dealDamage(ctx, target, hit.damage);
  recordHit(ctx, hit, removed);
}
