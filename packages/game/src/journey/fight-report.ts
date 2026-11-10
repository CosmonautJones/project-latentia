// What a finished battle reports to the flow (telemetry and the debrief): its size, the cards your team fired and the
// debrief's lines. Pure: built from the fight's event stream.

import type { BattleEvent } from '@latentia/engine';
import type { FightBattle, FightOutcome, FightReport } from '../flow/telemetry.js';

export interface FightInput {
  readonly battle: FightBattle;
  readonly outcome: FightOutcome;
  readonly rounds: number;
  readonly events: readonly BattleEvent[];
  readonly cardId: string | null;
  readonly kept: readonly string[];
  /** Whether a creature is on the player's side. */
  readonly mine: (index: number) => boolean;
}

export function fightReport(f: FightInput): FightReport {
  return {
    battle: f.battle,
    outcome: f.outcome,
    rounds: f.rounds,
    moves: f.events.filter((e) => e.type === 'MoveUsed').length,
    cardsFired: f.events.filter((e) => e.type === 'CardTrace' && f.mine(e.actor)).length,
    cardId: f.cardId,
    kept: [...f.kept],
  };
}
