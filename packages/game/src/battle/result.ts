// What a finished battle tells the flow, and what it says. A loss (or a round-cap draw) is battleLost, which restarts
// the same fight; losing to the trainer also says what the player's deck-driven teammates kept doing, from their
// CardTraces (P4 builds the teach → rematch loop on this).

import type { FlowEvent } from '../flow/flow.js';
import type { BattleDef } from '../content/battles.js';
import type { Outcome } from './session.js';

export interface BattleResult {
  readonly event: Extract<FlowEvent, { type: 'battleWon' | 'battleLost' }>;
  readonly text: string;
}

/** `teamSummary`: summarizeTraces lines for the player's side only. */
export function battleResult(def: BattleDef, outcome: Outcome, teamSummary: readonly string[]): BattleResult {
  if (outcome === 'win') return { event: { type: 'battleWon' }, text: def.win };
  if (outcome === 'draw') return { event: { type: 'battleLost' }, text: 'Round cap reached: a draw. Nobody ships. Run it back.' };
  const summary = def.id === 'trainer' && teamSummary.length > 0 ? ` What your team kept doing: ${teamSummary.join(' ')}` : '';
  return { event: { type: 'battleLost' }, text: `${def.lose}${summary}` };
}
