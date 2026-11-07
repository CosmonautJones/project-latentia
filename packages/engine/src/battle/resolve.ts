import type { BattleEvent } from '../events/types.js';
import type { ActionDraws } from '../rng/draws.js';
import type { ActionEntry } from './order.js';
import type { BattleState } from './state.js';

/**
 * Resolves one acting entry after its six draws are taken and ActionStarted is emitted (spec §5 step 4).
 * Stub until A12a replaces it with the resolution pipeline; it changes nothing and emits nothing.
 */
export function resolveAction(state: BattleState, entry: ActionEntry, draws: ActionDraws, events: BattleEvent[]): void {
  void state;
  void entry;
  void draws;
  void events;
}
