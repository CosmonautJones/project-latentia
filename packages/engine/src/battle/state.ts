import type { NextActionMod } from '../content/primitives.js';
import type { ContextState } from '../context/store.js';
import type { GridLayout } from '../grid/model.js';
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
  /** Known move ids, in setup order. */
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
};

export type SideState = {
  /** A copy of the setup grid; loadout pieces are fixed at battle start. */
  grid: GridLayout | null;
  temperature: Temperature;
  autopilot: { deck: Deck; temperature: Temperature } | null;
  opponentId: string;
  /** True once the orchestrator is KO'd (spec §5 Headless Mode). */
  headless: boolean;
  /** Subagent Slot piece ids removed from the active slots for the rest of the battle. */
  removedSlots: string[];
};

/** A timed field effect; the shape is defined when timedField lands (A13). Empty until then. */
export type FieldState = never;

export type Outcome = SideId | 'draw';

export type BattleState = {
  /** 0 before the first round. */
  round: number;
  rng: RngState;
  /** Index = canonical index. */
  creatures: CreatureState[];
  sides: { a: SideState; b: SideState };
  fields: FieldState[];
  ended: boolean;
  result: Outcome | null;
};
