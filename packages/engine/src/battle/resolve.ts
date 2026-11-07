import type { MoveDef, NonPassiveEffect } from '../content/primitives.js';
import { addObservation, freeOldestNonJunk, pay } from '../context/store.js';
import type { BattleEvent } from '../events/types.js';
import { hitChance } from '../math/accuracy.js';
import { EngineInvariantError, mulBp } from '../math/bp.js';
import { lo, type ActionDraws } from '../rng/draws.js';
import { hasStatus } from '../status/apply.js';
import { holds } from './effects/conditions.js';
import { chancePasses, creature, effectContext, temperatureRow, type EffectContext } from './effects/context.js';
import { applyDamage } from './effects/damage.js';
import { applyMultiHit } from './effects/multiHit.js';
import { breakEnemyChains, extendChain } from './handoff.js';
import type { ActionEntry } from './order.js';
import type { BattleState, CreatureState, Temperature } from './state.js';
import { chooseAction, temperatureOf } from './targeting.js';

export type { EffectContext } from './effects/context.js';

/** Rate Limited loses the turn when lo(D2, 100) is below this (spec §5 D2 lo). */
export const RATE_LIMITED_SKIP_PCT = 25;
/** Robust band (generalization ≥ 70) and its accuracy bonus against foes not in its recorded examples. */
export const ROBUST_MIN_GENERALIZATION = 70;
export const ROBUST_ACCURACY_BONUS = 5;

/**
 * Applies one effect of the move (the dispatcher). Its optional chance gate is checked first. Kinds that
 * later tasks implement (A12b, A13) throw EngineInvariantError until then.
 */
export function applyEffect(ctx: EffectContext, effect: NonPassiveEffect): void {
  switch (effect.kind) {
    case 'damage':
      if (chancePasses(ctx, effect.chance)) applyDamage(ctx, effect);
      return;
    case 'multiHit':
      if (chancePasses(ctx, effect.chance)) applyMultiHit(ctx, effect);
      return;
    default:
      throw new EngineInvariantError(`unimplemented effect kind ${effect.kind}`, { round: ctx.round, actor: ctx.actor, seed: ctx.state.seed });
  }
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
 * Resolves one acting entry after its six draws are taken and ActionStarted is emitted (spec §5 step 4):
 * Rate Limited skip check (lo D2) → hallucination / Drift substitution and re-targeting → MoveUsed → pay
 * context (overflow → Drift) → failsIf / accuracy (lo D3; a miss skips the whole effect list, Ruling 13)
 * → effects in list order (crit lo D4, roll lo D5, hit count hi D5, riders D6) → bookkeeping → history.
 * An action that gets past the skip checks breaks the enemy's Handoff chains. Uses only the six given draws.
 */
export function resolveAction(state: BattleState, entry: ActionEntry, draws: ActionDraws, events: BattleEvent[]): void {
  const round = state.round;
  const user = creature({ state, round }, entry.actor);
  if (hasStatus(user, 'rateLimited') && lo(draws.d2, 100) < RATE_LIMITED_SKIP_PCT) {
    events.push({ round, type: 'ActionSkipped', actor: user.index, reason: 'rateLimited' });
    return;
  }
  const temperature = temperatureOf(state, user);
  const choice = chooseAction(state, user, entry, draws, temperature);
  if (choice === null) {
    events.push({ round, type: 'ActionSkipped', actor: user.index, reason: 'fainted' });
    return;
  }
  const { move } = choice;
  breakEnemyChains(state, user.side);
  events.push({ round, type: 'MoveUsed', actor: user.index, moveId: move.id, target: choice.target });
  events.push(...pay(user.context, move.cost, round, user.index));
  const ctx = effectContext(state, user.index, choice.target, move, draws, temperature, events, takePenaltyBp(user));
  const target = creature(ctx, choice.target);
  const effects = effectList(move, temperature);
  if (fails(ctx, effects) || !accuracyHits(ctx, user, target)) {
    events.push({ round, type: 'Missed', actor: user.index, target: target.index });
  } else {
    for (const e of effects) applyEffect(ctx, e);
  }
  bookkeeping(ctx, user, target);
  user.actedThisBattle = true;
  user.lastMoveId = move.id;
  user.moveHistory.push({ round, moveId: move.id, damaged: [...ctx.tally.damaged] });
}
