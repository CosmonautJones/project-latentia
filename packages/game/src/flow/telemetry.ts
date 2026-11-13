// Local-only play telemetry (plan step 8): kept in the save and shown on the end card, never sent anywhere. The loop
// counters are about Bootcamp Grad (the core-loop test): `losses` are trainer losses, `swaps` card swaps between
// trainer fights, `rematches` trainer fights started again from the debrief. The totals and the fight log cover
// every battle that reported a fight.

/** The battles of the journey (the flow's battle steps). */
export type FightBattle = 'rival' | 'wild' | 'trainer';
export type FightOutcome = 'win' | 'lose' | 'draw';

/** One finished fight, as the log keeps it. */
export interface FightRecord {
  readonly battle: FightBattle;
  readonly outcome: FightOutcome;
  readonly rounds: number;
  /** Moves used by every creature in the fight (MoveUsed events). */
  readonly moves: number;
  /** Cards your deck-driven teammates fired (their CardTraces, Default included). */
  readonly cardsFired: number;
  /** The card taught to Tokenibble for this fight; null when it had none (no subagent, or the graft path). */
  readonly cardId: string | null;
}

/** A fight plus what the debrief says about it: the plain-words "Tokenibble kept ..." lines (or the graft hint). */
export interface FightReport extends FightRecord {
  readonly kept: readonly string[];
}

export interface Telemetry {
  readonly losses: number;
  readonly swaps: number;
  readonly rematches: number;
  /** Rounds played, over every reported fight. */
  readonly turns: number;
  readonly moves: number;
  readonly cardsFired: number;
  /** The most recent fights, oldest first (at most FIGHT_LOG_CAP). */
  readonly fights: readonly FightRecord[];
}

export const FIGHT_LOG_CAP = 40;

export const NO_TELEMETRY: Telemetry = { losses: 0, swaps: 0, rematches: 0, turns: 0, moves: 0, cardsFired: 0, fights: [] };

export const recordOf = (f: FightReport): FightRecord => ({
  battle: f.battle,
  outcome: f.outcome,
  rounds: f.rounds,
  moves: f.moves,
  cardsFired: f.cardsFired,
  cardId: f.cardId,
});

/** The telemetry after a fight is reported. */
export function withFight(t: Telemetry, f: FightReport): Telemetry {
  return {
    ...t,
    turns: t.turns + f.rounds,
    moves: t.moves + f.moves,
    cardsFired: t.cardsFired + f.cardsFired,
    fights: [...t.fights, recordOf(f)].slice(-FIGHT_LOG_CAP),
  };
}

/** A trainer result sent without a report (the dev hook): an empty fight, so the debrief always has one. */
export const blankFight = (outcome: FightOutcome, cardId: string | null): FightReport => ({
  battle: 'trainer',
  outcome,
  rounds: 0,
  moves: 0,
  cardsFired: 0,
  cardId,
  kept: [],
});
