import type { MoveDef, NonPassiveEffect } from '../content/primitives.js';
import { addObservation, freeOldestNonJunk, pay } from '../context/store.js';
import type { BattleEvent } from '../events/types.js';
import { hitChance } from '../math/accuracy.js';
import { EngineInvariantError, mulBp } from '../math/bp.js';
import { lo, type ActionDraws } from '../rng/draws.js';
import { consumeInjection, hasStatus, moveCost } from '../status/apply.js';
import { applyCharge, chargesFirst, releaseEffects } from './effects/charge.js';
import { holds } from './effects/conditions.js';
import { chancePasses, creature, effectContext, temperatureRow, type EffectContext } from './effects/context.js';
import { applyDamage } from './effects/damage.js';
import { applyGuard, guardCheck, isGuardMove } from './effects/guard.js';
import { applyHeal } from './effects/heal.js';
import { applyMultiHit } from './effects/multiHit.js';
import { applyNextActionModifier } from './effects/nextActionModifier.js';
import { applyStage, buffTag } from './effects/stage.js';
import { applyCure, applyStatusEffect, heldInjection } from './effects/status.js';
import { applySwap } from './effects/swap.js';
import { applyTokens } from './effects/tokens.js';
import { breakEnemyChains, extendChain } from './handoff.js';
import type { ActionEntry } from './order.js';
import type { BattleState, CreatureState, Temperature } from './state.js';
import { aimInjected, aimMove, chooseAction, temperatureOf, type Choice } from './targeting.js';

export type { EffectContext } from './effects/context.js';

/** Rate Limited loses the turn when lo(D2, 100) is below this (spec §5 D2 lo). */
export const RATE_LIMITED_SKIP_PCT = 25;
/** Robust band (generalization ≥ 70) and its accuracy bonus against foes not in its recorded examples. */
export const ROBUST_MIN_GENERALIZATION = 70;
export const ROBUST_ACCURACY_BONUS = 5;

/**
 * Applies one effect of the move (the dispatcher). Its optional chance gate is checked first. Kinds that
 * A13 implements (timedField, snapshot, revert, reveal, reorder turnOrder, copy, shield, stealStage) throw
 * EngineInvariantError until then.
 */
export function applyEffect(ctx: EffectContext, effect: NonPassiveEffect): void {
  if (!chancePasses(ctx, effect.chance)) return;
  switch (effect.kind) {
    case 'damage':
      return applyDamage(ctx, effect);
    case 'multiHit':
      return applyMultiHit(ctx, effect);
    case 'charge':
      return applyCharge(ctx, effect);
    case 'heal':
      return applyHeal(ctx, effect);
    case 'stage':
      return applyStage(ctx, effect);
    case 'applyStatus':
      return applyStatusEffect(ctx, effect);
    case 'cure':
      return applyCure(ctx, effect);
    case 'tokens':
      return applyTokens(ctx, effect);
    case 'guard':
      return applyGuard(ctx, effect);
    case 'nextActionModifier':
      return applyNextActionModifier(ctx, effect);
    case 'reorder':
      if (effect.what === 'fieldSlot') return applySwap(ctx, effect);
      break;
    default:
      break;
  }
  throw new EngineInvariantError(`unimplemented effect kind ${effect.kind}`, { round: ctx.round, actor: ctx.actor, seed: ctx.state.seed });
}

/** Ruling 8: Wild lists replace the move's effects (wildT4 at T4, else wild at T3+). */
function effectList(move: MoveDef, t: Temperature): readonly NonPassiveEffect[] {
  if (t === 4 && move.wildT4 !== undefined) return move.wildT4;
  if (t >= 3 && move.wild !== undefined) return move.wild;
  return move.effects;
}

/** Removes the actor's pending `powerBp` modifiers (Refusal's penalty) and returns their product, or null. */
function takePenaltyBp(user: CreatureState): number | null {
  let bp: number | null = null;
  const kept: CreatureState['nextActionMods'] = [];
  for (const m of user.nextActionMods) {
    if (m.kind === 'powerBp') bp = bp === null ? m.bp : mulBp(bp, m.bp);
    else kept.push(m);
  }
  user.nextActionMods = kept;
  return bp;
}

/**
 * Accuracy (spec §5): a move with accuracy hits when lo(D3, 100) < clamp(MoveAcc + TempMod − 8 × Drift +
 * 10 × (AccStages − EvaStages) [+ 5 Robust vs a foe not in recordedFoes], 30, 100). Drift is read after paying.
 */
function accuracyHits(ctx: EffectContext, user: CreatureState, target: CreatureState): boolean {
  if (ctx.move.accuracy === null) return true;
  const robust =
    user.generalization !== null &&
    user.generalization >= ROBUST_MIN_GENERALIZATION &&
    target.side !== user.side &&
    !(user.recordedFoes ?? []).includes(target.id);
  const chance = hitChance({
    moveAcc: ctx.move.accuracy,
    tempMod: temperatureRow(ctx).accMod,
    drift: user.context.drift,
    accStages: user.stages.accuracy ?? 0,
    evaStages: target.stages.evasion ?? 0,
    robustBonus: robust ? ROBUST_ACCURACY_BONUS : 0,
  });
  return lo(ctx.draws.d3, 100) < chance;
}

/** A damage effect whose `failsIf` holds makes the whole move fail like a miss (Flash Inference). */
function fails(ctx: EffectContext, effects: readonly NonPassiveEffect[]): boolean {
  return effects.some((e) => e.kind === 'damage' && e.who === 'target' && e.failsIf !== undefined && holds(ctx, e.failsIf));
}

/**
 * After the effect list: the Handoff Chain (a landed hit on the target), Efficient Answer (a super-effective
 * hit frees the attacker's oldest non-Junk token), then the defender's first sighting of an enemy move
 * (an Observation token if a cell is free, with ObservationGained; the sighting is used up either way).
 */
function bookkeeping(ctx: EffectContext, user: CreatureState, target: CreatureState): void {
  const { round, events } = ctx;
  if (ctx.tally.damaged.includes(target.index)) extendChain(ctx.state, user.index, user.side, target.index, round, events);
  if (ctx.tally.superEffective) events.push(...freeOldestNonJunk(user.context, round, user.index));
  if (target.side === user.side || target.fainted || target.seenMoves.includes(ctx.move.id)) return;
  target.seenMoves.push(ctx.move.id);
  const added = addObservation(target.context, round, target.index);
  if (added.length === 0) return;
  target.observedMoves.push(ctx.move.id);
  events.push(...added, { round, type: 'ObservationGained', target: target.index, observation: ctx.move.id });
}

/**
 * Accuracy, then the target's guard, then the effect list in order (stopping early when an effect halts the
 * move, e.g. a failed guard). A miss or a full guard block skips the whole list (Ruling 13).
 */
function resolveEffects(ctx: EffectContext, effects: readonly NonPassiveEffect[], user: CreatureState, target: CreatureState): void {
  if (fails(ctx, effects) || !accuracyHits(ctx, user, target)) {
    ctx.events.push({ round: ctx.round, type: 'Missed', actor: user.index, target: target.index });
    return;
  }
  if (!guardCheck(ctx, effects, user, target)) return;
  for (const e of effects) {
    applyEffect(ctx, e);
    if (ctx.tally.halted) return;
  }
}

/** What the entry does, before MoveUsed: a released charge, a hijacked (Prompt Injected) action, or its own move. */
type Plan = { choice: Choice; release: { powerDelta: number } | null } | 'charging';

/**
 * A charging user counts one entry down: above 0 it waits ('charging'); at 0 the charged move is released at
 * its stored target (no substitution). Otherwise a held Prompt Injected choice replaces the action, and is
 * consumed (StatusExpired) only if the action goes ahead; else hallucination / Drift / the entry's move.
 */
function planAction(state: BattleState, user: CreatureState, entry: ActionEntry, draws: ActionDraws, temperature: Temperature, events: BattleEvent[]): Plan {
  const charge = user.charging;
  if (charge !== null) {
    charge.remaining -= 1;
    if (charge.remaining > 0) return 'charging';
    user.charging = null;
    return { choice: aimMove(state, user, charge.moveId, charge.target), release: { powerDelta: charge.powerDelta } };
  }
  const injected = heldInjection({ state, round: state.round }, user.index);
  if (injected === null) return { choice: chooseAction(state, user, entry, draws, temperature), release: null };
  const choice = aimInjected(state, user, injected);
  if (choice !== null) events.push(...consumeInjection(user, state.round).events);
  return { choice, release: null };
}

/**
 * Resolves one acting entry after its six draws are taken and ActionStarted is emitted (spec §5 step 4):
 * Rate Limited skip check (lo D2) → a charge's countdown / release, a Prompt Injected hijack, or
 * hallucination / Drift substitution and re-targeting → MoveUsed → pay context (cost − 1 while Quantized;
 * overflow → Drift; a buff move's tokens carry its buff tag; a release pays nothing) → a charge round stops
 * here (no accuracy, Ruling 13) → failsIf / accuracy (lo D3) → the target's guard → effects in list order
 * (crit lo D4, roll lo D5, hit count hi D5, riders D6) → bookkeeping → guard streak → history. An action
 * that gets past the skip checks breaks the enemy's Handoff chains. Uses only the six given draws.
 */
export function resolveAction(state: BattleState, entry: ActionEntry, draws: ActionDraws, events: BattleEvent[]): void {
  const round = state.round;
  const user = creature({ state, round }, entry.actor);
  if (hasStatus(user, 'rateLimited') && lo(draws.d2, 100) < RATE_LIMITED_SKIP_PCT) {
    events.push({ round, type: 'ActionSkipped', actor: user.index, reason: 'rateLimited' });
    return;
  }
  const temperature = temperatureOf(state, user);
  const plan = planAction(state, user, entry, draws, temperature, events);
  if (plan === 'charging' || plan.choice === null) {
    events.push({ round, type: 'ActionSkipped', actor: user.index, reason: plan === 'charging' ? 'charging' : 'fainted' });
    return;
  }
  const { move, target: targetIndex } = plan.choice;
  breakEnemyChains(state, user.side);
  events.push({ round, type: 'MoveUsed', actor: user.index, moveId: move.id, target: targetIndex });
  const listed = effectList(move, temperature);
  const chargeRound = plan.release === null && chargesFirst(listed);
  if (plan.release === null) events.push(...pay(user.context, moveCost(user, move.cost), round, user.index, buffTag(listed)));
  // A charge round does not spend Refusal's penalty: the release is the move that deals the damage.
  const ctx = effectContext(state, user.index, targetIndex, move, draws, temperature, events, chargeRound ? null : takePenaltyBp(user));
  ctx.injection = entry.injection ?? null;
  if (plan.release !== null) ctx.powerAdd = plan.release.powerDelta;
  const target = creature(ctx, targetIndex);
  if (chargeRound) {
    for (const e of listed) if (e.kind === 'charge') applyEffect(ctx, e);
  } else {
    resolveEffects(ctx, plan.release === null ? listed : releaseEffects(listed), user, target);
  }
  bookkeeping(ctx, user, target);
  user.guardStreak = isGuardMove(listed) ? user.guardStreak + 1 : 0;
  user.actedThisBattle = true;
  user.lastMoveId = move.id;
  user.moveHistory.push({ round, moveId: move.id, damaged: [...ctx.tally.damaged] });
}
