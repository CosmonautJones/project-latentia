import type { NextActionMod } from '../content/primitives.js';
import type { ContextState } from '../context/store.js';
import type { GridLayout } from '../grid/model.js';
import type { RoundStartDraws } from '../rng/draws.js';
import type { SeedHex } from '../rng/seed.js';
import type { RngState } from '../rng/sfc32.js';
import type { StatusHolder } from '../status/apply.js';

// BattleState is plain JSON-compatible data (spec §4 "State representation"): numbers, strings,
// booleans, arrays and plain objects only. Absent values are `null`, never `undefined`, so a state
// survives canonicalJson, JSON round-trips and structuredClone unchanged. Content is referenced by id.

/** Opaque until B1 replaces it with the real type in cards/model.ts. */
export type Deck = unknown & { readonly __brand: 'Deck' };
/** Opaque until B1 replaces it with the real type in cards/model.ts. */
export type Card = unknown & { readonly __brand: 'Card' };

export type Version = 'v1' | 'v2' | 'v3.5' | 'v4';
export const VERSIONS: readonly Version[] = ['v1', 'v2', 'v3.5', 'v4'];

export type Temperature = 0 | 1 | 2 | 3 | 4;
export type SideId = 'a' | 'b';

/** Raw stats at the creature's level, before stages (spec §5 "Stats"). */
export type Stats = { compute: number; robustness: number; latency: number };

/** One resolved move of a creature (see CreatureState.moveHistory). */
export type MoveRecord = { round: number; moveId: string; damaged: number[] };

/** A move being charged (e.g. Deliberate); its remaining effects resolve when `remaining` reaches 0. */
export type ChargingState = { moveId: string; target: number; remaining: number; powerDelta: number };

/**
 * One creature. `index` (from StatusHolder) is its canonical index and equals its position in
 * `BattleState.creatures` for the whole battle.
 */
export type CreatureState = StatusHolder & {
  /** The setup's creature id. */
  id: string;
  speciesId: string;
  side: SideId;
  slot: 'orchestrator' | 'active' | 'bench';
  /** 0 or 1 while active, otherwise null. */
  activeSlot: 0 | 1 | null;
  /** Position in the side's bench order while benched (0-based; may exceed 2 after force-benching), otherwise null. */
  benchOrder: number | null;
  level: number;
  version: Version;
  hp: number;
  maxHp: number;
  stats: Stats;
  /**
   * Usable move ids: the listed moves (a gridded orchestrator's come from its grid: species signature,
   * then each Skill and graft piece's moveId in pieces order), then the universals compact, clear,
   * guardrail. Directive and Policy Update are command levers, never moves.
   */
  moves: string[];
  /** Orchestrator: window = grid headroom (species Ctx when the side has no grid). Subagent: window = species Ctx. */
  context: ContextState;
  /** Consecutive guard uses before the next action (spec §5 "Guards"). */
  guardStreak: number;
  fainted: boolean;
  deck: Deck | null;
  generalization: number | null;
  trainedTemperature: Temperature | null;
  recordedFoes: string[] | null;
  charging: ChargingState | null;
  /** Pending modifiers for the creature's next action (or next hit taken, for `incomingDamageBp`). */
  nextActionMods: NextActionMod[];
  actedThisBattle: boolean;
  lastMoveId: string | null;
  /**
   * Every move this creature resolved (not skipped), oldest first: the round, the move actually used
   * (after hallucination or Drift) and the canonical indices it damaged. Feeds the damage conditions
   * (targetActedThisRound, targetLastRound, userConsecutiveRoundsUsingType, hitsTakenFromTarget).
   */
  moveHistory: MoveRecord[];
  /** Enemy move ids this creature has been targeted by (first sightings, spec §5 Context). */
  seenMoves: string[];
  /** Enemy move ids it holds an Observation against: their hits on it take the 9000 modifier. */
  observedMoves: string[];
  /**
   * This round's R1/R2 (spec §5 draw table), taken for every creature at round start; null before round 1.
   * R1 low 16 bits = tie-break, `hi(r1, 2)` = seeded coin; `lo(r2, n)` = random-foe pick, `hi(r2, 100)` = passive proc.
   */
  roundStart: RoundStartDraws | null;
};

/**
 * One active slot, indexed by `CreatureState.activeSlot`. `occupant` is the canonical index of the
 * creature in it, or null when empty. On a gridded side `pieceId` is the bound Subagent Slot piece; a
 * gridded slot with `pieceId: null` has no piece and does not exist (it is never filled). On a gridless
 * side every `pieceId` is null and both slots exist. A slot is removed for the rest of the battle iff its
 * `pieceId` is in the orchestrator's `context.removedSlots` (the single source of truth). Later tasks
 * update `occupant` on Swap, Early Exit and force-bench; bench auto-fill skips removed and absent slots.
 */
export type SlotState = { pieceId: string | null; occupant: number | null };

export type SideState = {
  /** A copy of the setup grid; loadout pieces are fixed at battle start. */
  grid: GridLayout | null;
  temperature: Temperature;
  autopilot: { deck: Deck; temperature: Temperature } | null;
  opponentId: string;
  /** True once the orchestrator is KO'd (spec §5 Headless Mode). */
  headless: boolean;
  /** Always length 2. */
  slots: SlotState[];
};

/** A timed field effect; the shape is defined when timedField lands (A13). Empty until then. */
export type FieldState = never;

export type Outcome = SideId | 'draw';

/**
 * A Handoff Chain (spec §5 damage step 4): consecutive hits on `target` by creatures of `side` this
 * round, `actors` in hit order (a multi-hit move appears once). Cleared at round start and by any
 * action of a creature not on `side`.
 */
export type HandoffChain = { target: number; side: SideId; actors: number[] };

export type BattleState = {
  /** 0 before the first round. */
  round: number;
  /** The battle seed, kept for EngineInvariantError reports. */
  seed: SeedHex;
  rng: RngState;
  /** Index = canonical index. */
  creatures: CreatureState[];
  sides: { a: SideState; b: SideState };
  fields: FieldState[];
  /** This round's Handoff Chains, at most one per target. */
  handoff: HandoffChain[];
  ended: boolean;
  result: Outcome | null;
};
