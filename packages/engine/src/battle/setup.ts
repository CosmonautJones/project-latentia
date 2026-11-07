import { MOVES } from '../content/moves.js';
import { SPECIES, type SpeciesDef } from '../content/species.js';
import { newContext } from '../context/store.js';
import { cellsOf, type GridLayout } from '../grid/model.js';
import { validateGrid, type GridError, type ValidationResult } from '../grid/validate.js';
import { hpAt, statAt } from '../math/stats.js';
import { parseSeed, type SeedHex } from '../rng/seed.js';
import { seedRng } from '../rng/sfc32.js';
import { VERSIONS, type BattleState, type CreatureState, type Deck, type SideId, type SideState, type Temperature, type Version } from './state.js';

export type CreatureSetup = {
  id: string;
  species: string;
  level: number;
  version: Version;
  moves: string[];
  deck?: Deck;
  generalization?: number;
  trainedTemperature?: Temperature;
  recordedFoes?: string[];
};

export type SideSetup = {
  orchestrator: CreatureSetup;
  active: CreatureSetup[];
  bench: CreatureSetup[];
  grid: GridLayout | null;
  autopilot?: { deck: Deck; temperature: Temperature };
  opponentId: string;
};

export type BattleSetup = { a: SideSetup; b: SideSetup; kind: 'trainer' | 'wild' | 'ghost' };

export type ValidationError = GridError;
export type { ValidationResult };

export const MAX_ACTIVE = 2;
export const MAX_BENCH = 3;
/** A side's temperature before its first command (the bible's "Default" notch). */
export const DEFAULT_TEMPERATURE: Temperature = 2;

/** Thrown by createBattle for an invalid setup or seed; carries every error. */
export class SetupError extends Error {
  readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super(`invalid battle setup: ${errors.map((e) => `${e.path}: ${e.code}`).join('; ')}`);
    this.name = 'SetupError';
    this.errors = errors;
  }
}

function own(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function speciesOf(id: string): SpeciesDef | null {
  return own(SPECIES, id) ? (SPECIES[id as keyof typeof SPECIES] as SpeciesDef) : null;
}

/** A species knows its listed moves, its signature, and every universal move. */
function knowsMove(species: SpeciesDef, moveId: string): boolean {
  if (species.signature === moveId || species.moves.includes(moveId as never)) return true;
  return MOVES[moveId as keyof typeof MOVES].universal === true;
}

function validateCreature(c: CreatureSetup, path: string, errors: ValidationError[]): void {
  const species = speciesOf(c.species);
  if (species === null) errors.push({ code: 'unknownId', path: `${path}.species`, message: `unknown species ${String(c.species)}` });
  if (!Number.isSafeInteger(c.level) || c.level < 1 || c.level > 100) {
    errors.push({ code: 'level', path: `${path}.level`, message: `level must be an integer in 1..100, got ${String(c.level)}` });
  }
  if (!VERSIONS.includes(c.version)) errors.push({ code: 'version', path: `${path}.version`, message: `unknown version ${String(c.version)}` });
  for (let i = 0; i < c.moves.length; i++) {
    const moveId = c.moves[i] as string;
    const at = `${path}.moves[${i}]`;
    if (!own(MOVES, moveId)) errors.push({ code: 'unknownId', path: at, message: `unknown move ${String(moveId)}` });
    else if (species !== null && !knowsMove(species, moveId)) {
      errors.push({ code: 'moveNotKnown', path: at, message: `${species.id} does not know ${moveId}` });
    }
  }
}

function validateSide(side: SideSetup, id: SideId, errors: ValidationError[]): void {
  validateCreature(side.orchestrator, `${id}.orchestrator`, errors);
  side.active.forEach((c, i) => validateCreature(c, `${id}.active[${i}]`, errors));
  if (side.active.length > MAX_ACTIVE) {
    errors.push({ code: 'activeCount', path: `${id}.active[${MAX_ACTIVE}]`, message: `at most ${MAX_ACTIVE} active subagents, got ${side.active.length}` });
  }
  side.bench.forEach((c, i) => validateCreature(c, `${id}.bench[${i}]`, errors));
  if (side.bench.length > MAX_BENCH) {
    errors.push({ code: 'benchCount', path: `${id}.bench[${MAX_BENCH}]`, message: `at most ${MAX_BENCH} bench creatures, got ${side.bench.length}` });
  }
  if (side.grid !== null) {
    const result = validateGrid(side.grid, side.orchestrator.level);
    for (const e of result.errors) errors.push({ code: e.code, path: `${id}.grid.${e.path}`, message: e.message });
  }
}

/** Every problem with a setup, as `{ code, path, message }`, in side order (A then B). */
export function validateSetup(setup: BattleSetup): ValidationResult {
  const errors: ValidationError[] = [];
  validateSide(setup.a, 'a', errors);
  validateSide(setup.b, 'b', errors);
  return { ok: errors.length === 0, errors };
}

/** Empty cells of a valid grid (pieces are in bounds and never overlap). */
function headroomOf(grid: GridLayout): number {
  const occupied = new Set<string>();
  for (const p of grid.pieces) for (const [x, y] of cellsOf(p)) occupied.add(`${x},${y}`);
  return grid.width * grid.height - occupied.size;
}

type Placement = Pick<CreatureState, 'slot' | 'activeSlot' | 'benchOrder'>;

function buildCreature(c: CreatureSetup, index: number, side: SideId, place: Placement, window: number): CreatureState {
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
    moves: [...c.moves],
    context: newContext(window),
    guardStreak: 0,
    fainted: false,
    deck: c.deck === undefined ? null : structuredClone(c.deck),
    generalization: c.generalization ?? null,
    trainedTemperature: c.trainedTemperature ?? null,
    recordedFoes: c.recordedFoes === undefined ? null : [...c.recordedFoes],
    charging: null,
    nextActionMods: [],
    actedThisBattle: false,
    lastMoveId: null,
  };
}

/**
 * Appends one side's creatures in canonical order: orchestrator, active slot 1, active slot 2,
 * bench 1-3. Indices go only to creatures that exist, so they are contiguous with no gaps
 * (a side with one active and no bench takes exactly two indices).
 */
function addSide(creatures: CreatureState[], side: SideSetup, id: SideId): void {
  const orchSpecies = speciesOf(side.orchestrator.species) as SpeciesDef;
  const orchWindow = side.grid === null ? orchSpecies.ctx : headroomOf(side.grid);
  creatures.push(buildCreature(side.orchestrator, creatures.length, id, { slot: 'orchestrator', activeSlot: null, benchOrder: null }, orchWindow));
  side.active.forEach((c, i) => {
    const ctx = (speciesOf(c.species) as SpeciesDef).ctx;
    creatures.push(buildCreature(c, creatures.length, id, { slot: 'active', activeSlot: i === 0 ? 0 : 1, benchOrder: null }, ctx));
  });
  side.bench.forEach((c, i) => {
    const ctx = (speciesOf(c.species) as SpeciesDef).ctx;
    creatures.push(buildCreature(c, creatures.length, id, { slot: 'bench', activeSlot: null, benchOrder: i }, ctx));
  });
}

function buildSide(side: SideSetup): SideState {
  return {
    grid: side.grid === null ? null : structuredClone(side.grid),
    temperature: side.autopilot === undefined ? DEFAULT_TEMPERATURE : side.autopilot.temperature,
    autopilot: side.autopilot === undefined ? null : { deck: structuredClone(side.autopilot.deck), temperature: side.autopilot.temperature },
    opponentId: side.opponentId,
    headless: false,
    removedSlots: [],
  };
}

/**
 * Builds the round-0 state. Throws SetupError with every validation error (and a `seed` error for a
 * seed parseSeed rejects). The state shares no objects with `setup`.
 */
export function createBattle(setup: BattleSetup, seed: SeedHex): BattleState {
  const errors = [...validateSetup(setup).errors];
  const parsed = parseSeed(seed);
  if (!parsed.ok) errors.push({ code: 'seed', path: 'seed', message: `invalid seed (${parsed.error})` });
  if (errors.length > 0 || !parsed.ok) throw new SetupError(errors);

  const creatures: CreatureState[] = [];
  addSide(creatures, setup.a, 'a');
  addSide(creatures, setup.b, 'b');
  return {
    round: 0,
    rng: seedRng(parsed.words),
    creatures,
    sides: { a: buildSide(setup.a), b: buildSide(setup.b) },
    fields: [],
    ended: false,
    result: null,
  };
}
