import { moveDef } from '../../content/moves.js';
import type { NonPassiveEffect } from '../../content/primitives.js';
import { STATUSES } from '../../content/statuses.js';
import { changeDrift } from '../../context/store.js';
import { applyStatus, cureStatus, rollDuration, statusBlocked, type StatusInstance } from '../../status/apply.js';
import { aimsAtUser, lowestHpOnField } from '../order.js';
import { defaultTarget } from '../targeting.js';
import type { BattleState, CreatureState } from '../state.js';
import { creature, recipients, type EffectContext } from './context.js';
import { absorbStatus } from './shield.js';

export type ApplyStatusEffect = Extract<NonPassiveEffect, { kind: 'applyStatus' }>;
export type CureEffect = Extract<NonPassiveEffect, { kind: 'cure' }>;

/**
 * The default Prompt Injected choice (spec §5 Statuses): the victim's highest-power move (ties → first in
 * its moveset; its first move when none has power) aimed at its lowest-HP on-field ally other than itself
 * (HP ties → lowest index). With no such ally, the move's own default selector picks (Ruling 56), and only
 * if that finds nobody the victim itself; a self/none move aims at the victim.
 */
export function defaultInjection(state: BattleState, victim: CreatureState): { moveId: string; target: number } {
  let moveId = victim.moves[0] ?? 'compact';
  let best = -1;
  for (const id of victim.moves) {
    const power = moveDef(id)?.power ?? null;
    if (power !== null && power > best) {
      best = power;
      moveId = id;
    }
  }
  const def = moveDef(moveId);
  if (def === null || aimsAtUser(def)) return { moveId, target: victim.index };
  const ally = lowestHpOnField(state, (c) => c.side === victim.side && c.index !== victim.index);
  return { moveId, target: ally?.index ?? defaultTarget(state, victim, def) ?? victim.index };
}

/** The inflicter's choice: the command's `injection` when the victim knows its move, otherwise the default. */
function injectionFor(ctx: EffectContext, victim: CreatureState): { moveId: string; target: number } {
  const chosen = ctx.injection;
  if (chosen !== null && victim.moves.includes(chosen.moveId)) return { moveId: chosen.moveId, target: chosen.target };
  return defaultInjection(ctx.state, victim);
}

/**
 * The status instance for `victim`, its duration decided: `durationSlot` → rollDuration (min + hi(D6, span)),
 * else the fixed minimum. Glazed remembers its glazer; Overfit starts locked onto the target of the victim's
 * last resolved move (when it damaged one); Prompt Injected stores the inflicter's choice.
 */
function instanceFor(ctx: EffectContext, effect: ApplyStatusEffect, victim: CreatureState): StatusInstance {
  const remaining = effect.durationSlot === undefined ? STATUSES[effect.status].durationMin : rollDuration(effect.status, ctx.draws.d6);
  const inst: StatusInstance = { id: effect.status, remaining };
  if (effect.status === 'glazed') inst.source = ctx.actor;
  if (effect.status === 'overfit') {
    const last = victim.moveHistory.at(-1)?.damaged[0];
    if (last !== undefined) inst.source = last;
  }
  if (effect.status === 'promptInjected') inst.injected = injectionFor(ctx, victim);
  return inst;
}

/**
 * `applyStatus` on every living recipient (StatusApplied / StatusBlocked); Drift adds one stack instead. A
 * status that would land (not already blocked) first runs `incoming` — the recipient's statusIncoming
 * passives (Ruling 57) — then meets its status shield (Sagelet's Disclaimer), which stops it (StatusBlocked).
 */
export function applyStatusEffect(ctx: EffectContext, effect: ApplyStatusEffect, incoming: (c: CreatureState) => void = () => undefined): void {
  for (const c of recipients(ctx, effect.who)) {
    if (effect.status === 'drift' || !statusBlocked(c, effect.status)) {
      incoming(c);
      if (c.fainted || absorbStatus(c, effect.status, ctx.round, ctx.events)) continue;
    }
    if (effect.status === 'drift') ctx.events.push(...changeDrift(c.context, 1, ctx.round, c.index));
    else ctx.events.push(...applyStatus(c, instanceFor(ctx, effect, c), ctx.round));
  }
}

/** `cure`: removes each listed held status (StatusCured); Drift loses `driftStacks` stacks, or all of them. */
export function applyCure(ctx: EffectContext, effect: CureEffect): void {
  for (const c of recipients(ctx, effect.who)) {
    for (const id of effect.statuses) {
      if (id === 'drift') ctx.events.push(...changeDrift(c.context, -(effect.driftStacks ?? c.context.drift), ctx.round, c.index));
      else ctx.events.push(...cureStatus(c, id, ctx.round));
    }
  }
}

/** The stored Prompt Injected choice the user's next action must follow, or null when it holds none. */
export function heldInjection(ctx: Pick<EffectContext, 'state' | 'round'>, actor: number): { moveId: string; target: number } | null {
  return creature(ctx, actor).statuses.find((s) => s.id === 'promptInjected')?.injected ?? null;
}
