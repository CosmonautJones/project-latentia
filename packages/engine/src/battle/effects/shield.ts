import type { NonPassiveEffect } from '../../content/primitives.js';
import type { BattleEvent } from '../../events/types.js';
import type { CreatureState, ShieldState } from '../state.js';
import { recipients, type EffectContext } from './context.js';

export type ShieldEffect = Extract<NonPassiveEffect, { kind: 'shield' }>;

/** `shield` (Forkling's decoy, Sagelet's Disclaimer): adds `count` to each living recipient's shield of that kind. */
export function applyShield(ctx: EffectContext, effect: ShieldEffect): void {
  for (const c of recipients(ctx, effect.who)) {
    const held = c.shields.find((s) => s.against === effect.against);
    if (held === undefined) c.shields.push({ against: effect.against, count: effect.count });
    else held.count += effect.count;
  }
}

/** Uses one charge of the holder's `against` shield; returns the charges left, or null when it holds none. */
function spend(c: CreatureState, against: ShieldState['against']): number | null {
  const held = c.shields.find((s) => s.against === against);
  if (held === undefined || held.count < 1) return null;
  held.count -= 1;
  if (held.count === 0) c.shields = c.shields.filter((s) => s !== held);
  return held.count;
}

/**
 * A hit about to land on `victim` (one hit of `damage`, or of each `multiHit` hit): a hit shield absorbs it
 * — no damage — and emits ShieldAbsorbed { hitsLeft }. Returns whether it was absorbed.
 */
export function absorbHit(victim: CreatureState, round: number, events: BattleEvent[]): boolean {
  const left = spend(victim, 'hit');
  if (left === null) return false;
  events.push({ round, type: 'ShieldAbsorbed', target: victim.index, hitsLeft: left });
  return true;
}

/**
 * A status about to land on `victim` (it would not be blocked otherwise): a status shield stops it, which is
 * announced as StatusBlocked (Ruling 57). Returns whether it was stopped.
 */
export function absorbStatus(victim: CreatureState, status: string, round: number, events: BattleEvent[]): boolean {
  if (spend(victim, 'status') === null) return false;
  events.push({ round, type: 'StatusBlocked', target: victim.index, status });
  return true;
}
