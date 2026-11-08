import type { BattleEvent } from '../../events/types.js';
import { sideNumber } from '../end.js';
import type { BattleState, FieldState } from '../state.js';
import { creature } from './context.js';

// Ending timed fields (FieldEffectEnded). Kept apart from timedField.ts so that swap.ts can end a leaving
// creature's fields without an import cycle (timedField → tokens → swap).

/** Emits FieldEffectEnded for `f` (the caller removes it from BattleState.fields). */
export function fieldEnded(state: BattleState, f: FieldState, events: BattleEvent[]): void {
  const holder = creature({ state, round: state.round }, f.target);
  events.push({ round: state.round, type: 'FieldEffectEnded', effect: f.effect.kind, side: sideNumber(holder.side), target: f.target });
}

/** Ruling 63: every field held by the creature ends when it leaves the field, in the order they started. */
export function endFieldsOn(state: BattleState, index: number, events: BattleEvent[]): void {
  for (const f of state.fields) if (f.target === index) fieldEnded(state, f, events);
  state.fields = state.fields.filter((f) => f.target !== index);
}
