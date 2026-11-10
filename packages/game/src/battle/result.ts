// What a finished battle tells the flow, and what it says. A win is battleWon and a loss (or a round-cap draw)
// battleLost, each carrying the fight's report (telemetry, and the debrief after Bootcamp Grad). A lost rival or wild
// battle restarts; a trainer result goes to the debrief (lose → teach → rematch).

import type { BattleDef } from '../content/battles.js';
import type { FlowEvent } from '../flow/flow.js';
import type { FightReport } from '../flow/telemetry.js';
import type { Outcome } from './session.js';

export interface BattleResult {
  readonly event: Extract<FlowEvent, { type: 'battleWon' | 'battleLost' }>;
  readonly text: string;
}

const DRAW = 'Round cap reached: a draw. Nobody ships. Run it back.';

export function battleResult(def: BattleDef, outcome: Outcome, fight: FightReport): BattleResult {
  if (outcome === 'win') return { event: { type: 'battleWon', fight }, text: def.win };
  return { event: { type: 'battleLost', fight }, text: outcome === 'draw' ? DRAW : def.lose };
}
