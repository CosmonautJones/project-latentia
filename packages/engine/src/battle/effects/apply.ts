import type { MoveDef, NonPassiveEffect, Passive, PassiveTrigger } from '../../content/primitives.js';
import { deepFreeze } from '../../content/primitives.js';
import { SPECIES, type SpeciesId } from '../../content/species.js';
import { addObservation, freeOldestNonJunk, pay } from '../../context/store.js';
import type { BattleEvent } from '../../events/types.js';
import { hitChance } from '../../math/accuracy.js';
import { EngineInvariantError } from '../../math/bp.js';
import { lo, type ActionDraws } from '../../rng/draws.js';
import { moveCost, statStage } from '../../status/apply.js';
import { extendChain } from '../handoff.js';
import type { BattleState, CreatureState, Temperature } from '../state.js';
import { legalTarget } from '../order.js';
import { aimMove, temperatureOf } from '../targeting.js';
import { applyCharge, chargesFirst } from './charge.js';
import { holds } from './conditions.js';
import { chancePasses, creature, effectContext, temperatureRow, type EffectContext } from './context.js';
import { applyCopyBuff, copySource, type CopyMoveEffect } from './copy.js';
import { applyDamage } from './damage.js';
import { applyGuard, guardCheck } from './guard.js';
import { applyHeal } from './heal.js';
import { applyMultiHit } from './multiHit.js';
import { applyNextActionModifier } from './nextActionModifier.js';
import { applyReorder } from './reorder.js';
import { applyReveal } from './reveal.js';
import { applyShield } from './shield.js';
import { applyRevert, applySnapshot } from './snapshot.js';
import { applyStage, buffTag } from './stage.js';
import { applyCure, applyStatusEffect } from './status.js';
import { applyStealStage } from './stealStage.js';
import { applySwap } from './swap.js';
import { applyTimedField, fieldAccuracyStages } from './timedField.js';
import { applyTokens } from './tokens.js';

// The effect pipeline shared by moves, copied moves and passives: the dispatcher, accuracy, the guard check,
// the effect list, post-move bookkeeping, and the passive runner (they call each other, so they live together).

/**
 * Robust band (generalization ≥ 70) and its accuracy bonus, for subagents only, against foes of an opponent its
 * examples were not recorded from: `recordedFoes` holds opponent ids, matched against the id of the opponent its
 * side faces (`SideState.opponentId`), like Specialist's `recordedFrom` (Ruling 80).
 */
export const ROBUST_MIN_GENERALIZATION = 70;
export const ROBUST_ACCURACY_BONUS = 5;
const STAGE_MIN = -3;
const STAGE_MAX = 3;

/** Applies one effect (the dispatcher). Its optional chance gate is checked first. Every kind is implemented. */
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
      return applyStatusEffect(ctx, effect, (c) => runTrigger(ctx.state, c, 'statusIncoming', ctx.events));
    case 'cure':
      return applyCure(ctx, effect);
    case 'tokens':
      return applyTokens(ctx, effect);
    case 'timedField':
      return applyTimedField(ctx, effect);
    case 'nextActionModifier':
      return applyNextActionModifier(ctx, effect);
    case 'snapshot':
      return applySnapshot(ctx, effect);
    case 'revert':
      return applyRevert(ctx, effect);
    case 'reveal':
      return applyReveal(ctx, effect);
    case 'reorder':
      return effect.what === 'fieldSlot' ? applySwap(ctx, effect) : applyReorder(ctx, effect);
    case 'copy':
      return effect.what === 'move' ? applyCopyMove(ctx, effect) : applyCopyBuff(ctx, effect);
    case 'guard':
      return applyGuard(ctx, effect);
    case 'shield':
      return applyShield(ctx, effect);
    case 'stealStage':
      return applyStealStage(ctx, effect);
    default: {
      const unknown: never = effect;
      throw new EngineInvariantError(`unknown effect kind ${String((unknown as { kind: unknown }).kind)}`, { round: ctx.round, actor: ctx.actor, seed: ctx.state.seed });
    }
  }
}

/** Ruling 8: Wild lists replace the move's effects (wildT4 at T4, else wild at T3+). */
export function effectList(move: MoveDef, t: Temperature): readonly NonPassiveEffect[] {
  if (t === 4 && move.wildT4 !== undefined) return move.wildT4;
  if (t >= 3 && move.wild !== undefined) return move.wild;
  return move.effects;
}

/**
 * Accuracy (spec §5): a move with accuracy hits when lo(D3, 100) < clamp(MoveAcc ± `accuracy` modifiers +
 * TempMod − 8 × Drift + 10 × (AccStages − EvaStages) [+ 5 Robust subagent vs an unrecorded opponent], 30, 100).
 * Both stages are taken after Quantized's −1 (statStage, Ruling 78) — stages are combined first, then the
 * special rules apply (Ruling 49): AccStages add Saliency Map's field stages (clamped −3…+3);
 * `ignoreEvasion` ignores a positive evasion stage; `cannotMiss` always hits. Drift is read after paying.
 */
function accuracyHits(ctx: EffectContext, user: CreatureState, target: CreatureState): boolean {
  if (ctx.move.accuracy === null || ctx.accMods.cannotMiss) return true;
  const robust =
    !user.isOrchestrator &&
    user.generalization !== null &&
    user.generalization >= ROBUST_MIN_GENERALIZATION &&
    target.side !== user.side &&
    !(user.recordedFoes ?? []).includes(ctx.state.sides[user.side].opponentId);
  const evasion = statStage(target, 'evasion');
  const chance = hitChance({
    moveAcc: ctx.move.accuracy + ctx.accMods.accuracy,
    tempMod: temperatureRow(ctx).accMod,
    drift: user.context.drift,
    accStages: Math.max(STAGE_MIN, Math.min(STAGE_MAX, statStage(user, 'accuracy') + fieldAccuracyStages(ctx.state, user.index))),
    evaStages: ctx.accMods.ignoreEvasion ? Math.min(0, evasion) : evasion,
    robustBonus: robust ? ROBUST_ACCURACY_BONUS : 0,
  });
  return lo(ctx.draws.d3, 100) < chance;
}

/** A damage effect whose `failsIf` holds makes the whole move fail like a miss (Flash Inference). */
function fails(ctx: EffectContext, effects: readonly NonPassiveEffect[]): boolean {
  return effects.some((e) => e.kind === 'damage' && e.who === 'target' && e.failsIf !== undefined && holds(ctx, e.failsIf));
}

/**
 * Accuracy, then the target's guard, then the effect list in order (stopping early when an effect halts the
 * move, e.g. a failed guard). A `fail` modifier (Segfault), a failsIf, a miss or a full guard block skips
 * the whole list (Ruling 13).
 */
export function resolveEffects(ctx: EffectContext, effects: readonly NonPassiveEffect[], user: CreatureState, target: CreatureState): void {
  if (ctx.accMods.fail || fails(ctx, effects) || !accuracyHits(ctx, user, target)) {
    ctx.events.push({ round: ctx.round, type: 'Missed', actor: user.index, target: target.index });
    return;
  }
  if (!guardCheck(ctx, effects, user, target)) return;
  for (const e of effects) {
    applyEffect(ctx, e);
    if (ctx.tally.halted) return;
  }
}

/**
 * After the effect list: the Handoff Chain (a landed hit on the target), Efficient Answer (a super-effective
 * hit frees the attacker's oldest non-Junk token), then the defender's first sighting of an enemy move
 * (an Observation token if a cell is free, with ObservationGained; the sighting is used up either way).
 */
export function bookkeeping(ctx: EffectContext, user: CreatureState, target: CreatureState): void {
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
 * `copy` of a move (Episodic Replay, Stochastic Repeat; Rulings 58, 59). The copied move (copySource) is aimed
 * at the copier's own entry target if that is legal for the copied move, else at the copied move's original
 * target if legal, else by its default selector (self/none moves at the user; engine-picked kinds pick); with
 * no move to copy, or no target left, the copy fails (Missed). Otherwise MoveUsed for the copied move, the copied cost + costOffset is paid (min 0; Quantized
 * applies), and it resolves with THIS action's draws, modifiers and tally — its own accuracy on the same
 * lo(D3), its guard check, its effect list (a charge move only starts charging). The resolver's bookkeeping
 * then follows the copied move (`ctx.copied`).
 */
function applyCopyMove(ctx: EffectContext, effect: CopyMoveEffect): void {
  const user = creature(ctx, ctx.actor);
  const source = copySource(ctx, effect);
  const intended = source === null || !legalTarget(ctx.state, user, source.def, ctx.target) ? source?.target : ctx.target;
  const choice = source === null || intended === undefined ? null : aimMove(ctx.state, user, source.def.id, intended);
  if (choice === null) {
    ctx.events.push({ round: ctx.round, type: 'Missed', actor: user.index, target: ctx.target });
    return;
  }
  const { move, target } = choice;
  ctx.events.push({ round: ctx.round, type: 'MoveUsed', actor: user.index, moveId: move.id, target });
  const list = effectList(move, ctx.temperature);
  ctx.events.push(...pay(user.context, moveCost(user, Math.max(0, move.cost + effect.costOffset)), ctx.round, user.index, buffTag(list)));
  const nested: EffectContext = { ...ctx, move, target, guardBp: null, powerAdd: 0, copied: null };
  if (chargesFirst(list)) {
    for (const e of list) if (e.kind === 'charge') applyEffect(nested, e);
    return;
  }
  resolveEffects(nested, list, user, creature(nested, target));
  ctx.copied = nested;
}

/** The context a passive runs in outside an action: the creature acts on itself; no move, no action draws. */
const PASSIVE_MOVE: MoveDef = deepFreeze({ id: 'passive', name: 'Passive', type: 'system', target: 'self', power: null, cost: 0, accuracy: null, priority: 0, effects: [] });
const NO_DRAWS: ActionDraws = Object.freeze({ d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, d6: 0 });

/**
 * Fires the `trigger` passives of `passives` (a species' list, in order) for living `c`: a `oncePerBattle`
 * passive only the first time. Effects run in `action` — the action's context, for afterFirstAction (its
 * tally, its round's r2hi) — or in a passive context (actor and target `c`, no move, no action draws).
 * Chance procs read r2hi (content rule). Passives never nest.
 */
export function firePassives(state: BattleState, c: CreatureState, passives: readonly Passive[], trigger: PassiveTrigger, events: BattleEvent[], action: EffectContext | null): void {
  passives.forEach((p, i) => {
    if (p.trigger !== trigger || c.fainted) return;
    if (p.oncePerBattle === true) {
      if (c.passivesUsed.includes(i)) return;
      c.passivesUsed.push(i);
    }
    const ctx = action ?? effectContext(state, c.index, c.index, PASSIVE_MOVE, NO_DRAWS, temperatureOf(state, c), events);
    for (const e of p.effects) applyEffect(ctx, e);
  });
}

/** Fires `c`'s species passives for `trigger` (see firePassives). */
export function runTrigger(state: BattleState, c: CreatureState, trigger: PassiveTrigger, events: BattleEvent[], action: EffectContext | null = null): void {
  const species = Object.prototype.hasOwnProperty.call(SPECIES, c.speciesId) ? SPECIES[c.speciesId as SpeciesId] : null;
  if (species === null) throw new EngineInvariantError(`unknown species ${c.speciesId}`, { round: state.round, actor: c.index, seed: state.seed });
  firePassives(state, c, species.passives, trigger, events, action);
}
