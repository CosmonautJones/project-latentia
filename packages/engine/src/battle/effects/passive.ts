import type { PassiveTrigger } from '../../content/primitives.js';
import type { BattleEvent } from '../../events/types.js';
import { EngineInvariantError } from '../../math/bp.js';
import { onField } from '../order.js';
import type { BattleState } from '../state.js';
import { runTrigger } from './apply.js';

// Where each species passive trigger fires (Ruling 57). The runner itself (firePassives / runTrigger) lives in
// apply.ts with the dispatcher; afterFirstAction is fired by resolveAction and statusIncoming inside status
// application.

/** Fires `trigger` for every living creature in canonical order (only those on the field with `fieldOnly`). */
function fireAll(state: BattleState, trigger: PassiveTrigger, events: BattleEvent[], fieldOnly = false): void {
  for (const c of state.creatures) if (!fieldOnly || onField(state, c)) runTrigger(state, c, trigger, events);
}

/**
 * battleStart, at createBattle (round 0, no event stream): every creature's battleStart passives, canonical
 * order. They may only set state up silently (shields, next-action modifiers such as Move Fast's priority,
 * used up at the creature's first Sort); one that would emit an event is a content bug and throws.
 */
export function applyBattleStartPassives(state: BattleState): void {
  const events: BattleEvent[] = [];
  fireAll(state, 'battleStart', events);
  if (events.length > 0) throw new EngineInvariantError(`battleStart passives must be silent, got ${events[0]?.type ?? ''}`, { round: 0, seed: state.seed });
}

/** roundEnd, at the start of end of round, before status ticks. */
export function roundEndPassives(state: BattleState, events: BattleEvent[]): void {
  fireAll(state, 'roundEnd', events);
}

/**
 * notKoThisRound, at end of round after the status and field ticks, for every creature still alive and on
 * the field — never a benched one (Ruling 60; Slopling).
 */
export function notKoPassives(state: BattleState, events: BattleEvent[]): void {
  fireAll(state, 'notKoThisRound', events, true);
}
