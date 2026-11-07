import type { NonPassiveEffect } from '../../content/primitives.js';
import type { BattleEvent } from '../../events/types.js';
import { EngineInvariantError } from '../../math/bp.js';
import { sideNumber } from '../end.js';
import { onField } from '../order.js';
import type { BattleState, CreatureState, FieldState, Temperature } from '../state.js';
import { creature, recipients, type EffectContext } from './context.js';
import { addJunk } from './tokens.js';

export type TimedFieldEffect = Extract<NonPassiveEffect, { kind: 'timedField' }>;

/** What a reveal field shows in its Revealed events; null for a field that reveals nothing. */
function revealWhat(field: FieldState['effect']): 'nextIntent' | 'topDeckCard' | null {
  if (field.kind === 'revealIntents') return 'nextIntent';
  return field.kind === 'revealTopDeckCard' ? 'topDeckCard' : null;
}

/**
 * Starts a timed field effect from `source` on `holder` for `rounds` end-of-round ticks, the current round
 * included (like statuses). The same effect kind on the same holder is refreshed — new source, `rounds`
 * again — never stacked. Emits FieldEffectStarted, then Revealed for a reveal (it shows this round too).
 */
export function startField(state: BattleState, source: number, holder: CreatureState, effect: FieldState['effect'], rounds: number, events: BattleEvent[]): void {
  const round = state.round;
  if (!Number.isSafeInteger(rounds) || rounds < 1) throw new EngineInvariantError(`field ${effect.kind} needs a positive duration`, { round, actor: source, seed: state.seed });
  const held = state.fields.find((f) => f.target === holder.index && f.effect.kind === effect.kind);
  if (held === undefined) state.fields.push({ effect: { ...effect }, source, target: holder.index, remaining: rounds });
  else Object.assign(held, { effect: { ...effect }, source, remaining: rounds });
  events.push({ round, type: 'FieldEffectStarted', effect: effect.kind, side: sideNumber(holder.side), target: holder.index, rounds });
  const what = revealWhat(effect);
  if (what !== null) events.push({ round, type: 'Revealed', actor: source, target: holder.index, what });
}

/** `timedField`: starts the field on every living recipient (Memory Leak, Saliency Map, Temperature Spike, Red Team). */
export function applyTimedField(ctx: EffectContext, effect: TimedFieldEffect): void {
  for (const c of recipients(ctx, effect.who)) startField(ctx.state, ctx.actor, c, effect.field, effect.rounds, ctx.events);
}

function ended(state: BattleState, f: FieldState, holder: CreatureState, events: BattleEvent[]): void {
  events.push({ round: state.round, type: 'FieldEffectEnded', effect: f.effect.kind, side: sideNumber(holder.side), target: f.target });
}

/**
 * End of round (spec §5 step 5), fields in the order they started: a field on a KO'd holder ends at once;
 * otherwise `junkPerRound` adds its Junk to the holder (forced tokens, spec §5 Context), the field counts one
 * round down, and at 0 it ends (FieldEffectEnded).
 */
export function tickFields(state: BattleState, events: BattleEvent[]): void {
  const kept: FieldState[] = [];
  for (const f of state.fields) {
    const holder = creature({ state, round: state.round }, f.target);
    if (holder.fainted) {
      ended(state, f, holder, events);
      continue;
    }
    if (f.effect.kind === 'junkPerRound') addJunk(state, holder, f.effect.count, state.round, events);
    f.remaining -= 1;
    if (f.remaining > 0) kept.push(f);
    else ended(state, f, holder, events);
  }
  state.fields = kept;
}

/**
 * Round start, after planning: each reveal field shows its holder again (Revealed { actor: source }), for a
 * living holder on the field only — a benched creature has no intent this round.
 */
export function roundStartReveals(state: BattleState, events: BattleEvent[]): void {
  for (const f of state.fields) {
    const what = revealWhat(f.effect);
    const holder = state.creatures[f.target];
    if (what === null || holder === undefined || holder.fainted || !onField(state, holder)) continue;
    events.push({ round: state.round, type: 'Revealed', actor: f.source, target: f.target, what });
  }
}

/** Temperature Spike: the notch forced on this creature, or null. */
export function forcedTemperature(state: BattleState, index: number): Temperature | null {
  const f = state.fields.find((x) => x.target === index && x.effect.kind === 'forceTemperature');
  return f !== undefined && f.effect.kind === 'forceTemperature' ? f.effect.temperature : null;
}

/** Saliency Map: accuracy stages the fields on this creature add to its moves. */
export function fieldAccuracyStages(state: BattleState, index: number): number {
  return state.fields.reduce((n, f) => (f.target === index && f.effect.kind === 'accuracyStages' ? n + f.effect.delta : n), 0);
}

/** Red Team: extra crit stages for an attacker against `target`, from fields its own side started on it. */
export function fieldCritStages(state: BattleState, attacker: CreatureState, target: number): number {
  return state.fields.reduce((n, f) => {
    if (f.target !== target || f.effect.kind !== 'critStagesAgainst') return n;
    return state.creatures[f.source]?.side === attacker.side ? n + f.effect.delta : n;
  }, 0);
}
