import type { Deck } from '../cards/model.js';
import type { SpeciesDef } from '../content/species.js';
import { newContext } from '../context/store.js';
import { cellsOf, type GridLayout } from '../grid/model.js';
import type { GridError, ValidationResult } from '../grid/validate.js';
import { hpAt, statAt } from '../math/stats.js';
import { parseSeed, type SeedHex } from '../rng/seed.js';
import { seedRng } from '../rng/sfc32.js';
import { applyBattleStartPassives } from './effects/passive.js';
import { DEFAULT_TEMPERATURE, type BattleState, type CreatureState, type SideId, type SideState, type SlotState, type Temperature, type Version } from './state.js';
import { MAX_ACTIVE, orchestratorMoves, slotPieces, speciesOf, validateSetup } from './validate-setup.js';

export type CreatureSetup = {
  id: string;
  species: string;
  level: number;
  version: Version;
  /** Never lists universal moves. Must be empty for a gridded orchestrator (its moves come from the grid). */
  moves: string[];
  deck?: Deck;
  generalization?: number;
  trainedTemperature?: Temperature;
  /** Opponent ids its training examples were recorded from (matched against its side's `opponentId`, Ruling 80). */
  recordedFoes?: string[];
};

export type SideSetup = {
  orchestrator: CreatureSetup;
  active: CreatureSetup[];
  bench: CreatureSetup[];
  grid: GridLayout | null;
  autopilot?: { deck: Deck; temperature: Temperature };
  /** The id of the opponent this side faces. */
  opponentId: string;
};

export type BattleSetup = { a: SideSetup; b: SideSetup; kind: 'trainer' | 'wild' | 'ghost' };

export type ValidationError = GridError;
export type { ValidationResult };

export { MAX_ACTIVE, MAX_BENCH, MAX_MOVES, validateSetup } from './validate-setup.js';
export { DEFAULT_TEMPERATURE };
/** Known by every creature, never listed, appended to every moveset in this order. */
export const UNIVERSAL_MOVES = ['compact', 'clear', 'guardrail'] as const;

/** Thrown by createBattle for an invalid setup or seed; carries every error. */
export class SetupError extends Error {
  readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super(`invalid battle setup: ${errors.map((e) => `${e.path}: ${e.code}`).join('; ')}`);
    this.name = 'SetupError';
    this.errors = errors;
  }
}

/** Empty cells of a valid grid (pieces are in bounds and never overlap). */
function headroomOf(grid: GridLayout): number {
  const occupied = new Set<string>();
  for (const p of grid.pieces) for (const [x, y] of cellsOf(p)) occupied.add(`${x},${y}`);
  return grid.width * grid.height - occupied.size;
}

type Placement = Pick<CreatureState, 'slot' | 'activeSlot' | 'benchOrder'>;

function buildCreature(c: CreatureSetup, index: number, side: SideId, place: Placement, window: number, moves: readonly string[]): CreatureState {
  const species = speciesOf(c.species) as SpeciesDef;
  const maxHp = hpAt(species.base.hp, c.level);
  return {
    index,
    statuses: [],
    stages: { compute: 0, robustness: 0, latency: 0, accuracy: 0, evasion: 0 },
    isOrchestrator: place.slot === 'orchestrator',
    id: c.id,
    speciesId: species.id,
    side,
    ...place,
    level: c.level,
    version: c.version,
    hp: maxHp,
    maxHp,
    stats: {
      compute: statAt(species.base.compute, c.level),
      robustness: statAt(species.base.robustness, c.level),
      latency: statAt(species.base.latency, c.level),
    },
    moves: [...moves, ...UNIVERSAL_MOVES],
    context: newContext(window),
    guardStreak: 0,
    guard: null,
    leftFieldRound: null,
    fainted: false,
    deck: c.deck === undefined ? null : structuredClone(c.deck),
    generalization: c.generalization ?? null,
    trainedTemperature: c.trainedTemperature ?? null,
    recordedFoes: c.recordedFoes === undefined ? null : [...c.recordedFoes],
    charging: null,
    nextActionMods: [],
    shields: [],
    snapshots: [],
    passivesUsed: [],
    actedThisBattle: false,
    lastMoveId: null,
    moveHistory: [],
    seenMoves: [],
    observedMoves: [],
    roundStart: null,
  };
}

/** Slot i holds active[i]: its bound piece on a gridded side; empty slots take unnamed slot pieces in order. */
function buildSlots(side: SideSetup, firstActive: number): SlotState[] {
  const pieces = side.grid === null ? [] : slotPieces(side.grid).map((s) => s.piece);
  const unnamed = pieces.filter((p) => p.subagentId === undefined).map((p) => p.id);
  const slots: SlotState[] = [];
  for (let i = 0; i < MAX_ACTIVE; i++) {
    const c = side.active[i];
    if (c === undefined) slots.push({ pieceId: side.grid === null ? null : (unnamed.shift() ?? null), occupant: null });
    else slots.push({ pieceId: pieces.find((p) => p.subagentId === c.id)?.id ?? null, occupant: firstActive + i });
  }
  return slots;
}

/**
 * Appends one side's creatures in canonical order: orchestrator, active slot 1, active slot 2,
 * bench 1-3. Indices go only to creatures that exist, so they are contiguous with no gaps
 * (a side with one active and no bench takes exactly two indices).
 */
function addSide(creatures: CreatureState[], side: SideSetup, id: SideId): SideState {
  const orchSpecies = speciesOf(side.orchestrator.species) as SpeciesDef;
  const grid = side.grid;
  const orchWindow = grid === null ? orchSpecies.ctx : headroomOf(grid);
  creatures.push(buildCreature(side.orchestrator, creatures.length, id, { slot: 'orchestrator', activeSlot: null, benchOrder: null }, orchWindow, orchestratorMoves(side)));
  const firstActive = creatures.length;
  side.active.forEach((c, i) => {
    const s = speciesOf(c.species) as SpeciesDef;
    creatures.push(buildCreature(c, creatures.length, id, { slot: 'active', activeSlot: i === 0 ? 0 : 1, benchOrder: null }, s.ctx, c.moves));
  });
  side.bench.forEach((c, i) => {
    const s = speciesOf(c.species) as SpeciesDef;
    creatures.push(buildCreature(c, creatures.length, id, { slot: 'bench', activeSlot: null, benchOrder: i }, s.ctx, c.moves));
  });
  return {
    grid: grid === null ? null : structuredClone(grid),
    temperature: side.autopilot === undefined ? DEFAULT_TEMPERATURE : side.autopilot.temperature,
    autopilot: side.autopilot === undefined ? null : { deck: structuredClone(side.autopilot.deck), temperature: side.autopilot.temperature },
    opponentId: side.opponentId,
    headless: false,
    slots: buildSlots(side, firstActive),
    lastMove: null,
    policies: [],
    directive: null,
  };
}

/**
 * Builds the round-0 state, battleStart passives applied (Ruling 57). Throws SetupError with every validation error (and a `seed` error for a
 * seed parseSeed rejects). The state shares no objects with `setup`.
 */
export function createBattle(setup: BattleSetup, seed: SeedHex): BattleState {
  const errors = [...validateSetup(setup).errors];
  const parsed = parseSeed(seed);
  if (!parsed.ok) errors.push({ code: 'seed', path: 'seed', message: `invalid seed (${parsed.error})` });
  if (errors.length > 0 || !parsed.ok) throw new SetupError(errors);

  const creatures: CreatureState[] = [];
  const a = addSide(creatures, setup.a, 'a');
  const b = addSide(creatures, setup.b, 'b');
  const state: BattleState = { round: 0, seed, rng: seedRng(parsed.words), creatures, sides: { a, b }, fields: [], turnOrder: [], handoff: [], ended: false, result: null };
  applyBattleStartPassives(state);
  return state;
}
