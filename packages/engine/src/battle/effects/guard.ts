import type { MoveDef, NonPassiveEffect } from '../../content/primitives.js';
import { mulBp } from '../../math/bp.js';
import { guardSucceeds } from '../../status/guards.js';
import type { CreatureState, GuardState } from '../state.js';
import { creature, type EffectContext } from './context.js';
import { computeHit, dealDamage, type HitShape } from './damage.js';

export type GuardEffect = Extract<NonPassiveEffect, { kind: 'guard' }>;

/** A move whose effect list (as resolved) raises a guard: it counts toward the shared guard streak. */
export function isGuardMove(effects: readonly NonPassiveEffect[]): boolean {
  return effects.some((e) => e.kind === 'guard');
}

/**
 * `guard` (spec §5 Guards): with k = the user's consecutive guard uses before this one, the guard goes up
 * when lo(D3, 729) < [729, 243, 81, 27, 9, 3][k] (k ≥ 6 always fails; `guardSucceeds`). It lasts until the
 * end of this round. A failed guard is announced as a Missed on the user and ends the move (the rest of its
 * effect list — Refusal's penalty — does not apply). The round loop updates the streak afterwards.
 */
export function applyGuard(ctx: EffectContext, effect: GuardEffect): void {
  const user = creature(ctx, ctx.actor);
  if (!guardSucceeds(user.guardStreak, ctx.draws.d3)) {
    ctx.events.push({ round: ctx.round, type: 'Missed', actor: user.index, target: user.index });
    ctx.tally.halted = true;
    return;
  }
  const block = effect.blockAttacks;
  user.guard = {
    kind: effect.guard,
    round: ctx.round,
    damageBp: effect.damageBp ?? null,
    blockStatusMoves: effect.blockStatusMoves === true,
    blockAttacks: block === undefined ? null : { ofType: block.ofType ?? null, remaining: block.limit ?? null },
    reflectBp: effect.reflectBp ?? null,
  };
}

/** The holder's guard if it is up this round and `user` is a foe; null otherwise (guards ignore allies). */
function activeGuard(ctx: EffectContext, user: CreatureState, holder: CreatureState): GuardState | null {
  const g = holder.guard;
  return g !== null && g.round === ctx.round && holder.side !== user.side && !holder.fainted ? g : null;
}

/** A move with power is an attack; one without is a status move (bible guard text, Ruling 48's definition). */
const isAttack = (move: MoveDef): boolean => move.power !== null;

/** Did this move hit `holder` last round (any user)? Unit Test reflects exactly those. */
function hitHolderLastRound(ctx: EffectContext, holder: CreatureState): boolean {
  return ctx.state.creatures.some((c) => c.moveHistory.some((r) => r.round === ctx.round - 1 && r.moveId === ctx.move.id && r.damaged.includes(holder.index)));
}

/** Unit Test: one hit of the move is computed against the holder, and the attacker takes reflectBp of it. */
function reflect(ctx: EffectContext, effects: readonly NonPassiveEffect[], user: CreatureState, holder: CreatureState, reflectBp: number): void {
  const first = effects.find((e) => e.kind === 'damage' && e.who === 'target');
  const shape: HitShape = first?.kind === 'damage' && first.who === 'target' ? first : {};
  const hit = computeHit(ctx, shape, null);
  if (!user.fainted) dealDamage({ ...ctx, actor: holder.index }, user, mulBp(hit.damage, reflectBp));
}

/**
 * The target's guard meets a landed move from a foe (after accuracy, before the effect list). Returns
 * whether the effect list still applies. GuardResolved { actor: attacker, target: holder, blocked } is
 * emitted whenever the guard acts:
 * - Captcha Wall vs an attack of its blocked type (Speed): blocked, and it counts as a miss (Missed).
 * - Refusal vs an attack while its limit lasts: blocked (the limit is used up).
 * - Guardrail vs a status move: blocked (Prompt Injected included).
 * - Unit Test vs a move that hit the holder last round: blocked, and reflected at reflectBp to the attacker.
 * - Guardrail, or Captcha Wall vs any other attack: not blocked; the hit takes the Guard modifier (5000).
 * Anything else passes untouched.
 */
export function guardCheck(ctx: EffectContext, effects: readonly NonPassiveEffect[], user: CreatureState, holder: CreatureState): boolean {
  const g = activeGuard(ctx, user, holder);
  if (g === null) return true;
  const resolved = (blocked: boolean) => ctx.events.push({ round: ctx.round, type: 'GuardResolved', actor: user.index, target: holder.index, kind: g.kind, blocked });
  const attack = isAttack(ctx.move);
  const block = g.blockAttacks;
  if (attack && block !== null && (block.ofType === null || block.ofType === ctx.move.type) && block.remaining !== 0) {
    if (block.remaining !== null) block.remaining -= 1;
    resolved(true);
    if (block.ofType !== null) ctx.events.push({ round: ctx.round, type: 'Missed', actor: user.index, target: holder.index });
    return false;
  }
  if (!attack && g.blockStatusMoves) {
    resolved(true);
    return false;
  }
  if (attack && g.reflectBp !== null && hitHolderLastRound(ctx, holder)) {
    resolved(true);
    reflect(ctx, effects, user, holder, g.reflectBp);
    return false;
  }
  if (attack && g.damageBp !== null) {
    resolved(false);
    ctx.guardBp = g.damageBp;
  }
  return true;
}
