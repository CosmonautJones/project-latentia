import { MOVES, SIGNATURE_MOVE_IDS } from '../content/moves.js';
import { SPECIES, type SpeciesDef } from '../content/species.js';
import { newContext } from '../context/store.js';
import { cellsOf, type GridLayout, type PlacedPiece } from '../grid/model.js';
import { validateGrid, type GridError, type ValidationResult } from '../grid/validate.js';
import { hpAt, statAt } from '../math/stats.js';
import { parseSeed, type SeedHex } from '../rng/seed.js';
import { seedRng } from '../rng/sfc32.js';
import { VERSIONS, type BattleState, type CreatureState, type Deck, type SideId, type SideState, type SlotState, type Temperature, type Version } from './state.js';

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
/** Most non-universal moves a subagent may list. */
export const MAX_MOVES = 4;
/** Known by every creature, never listed, appended to every moveset in this order. */
export const UNIVERSAL_MOVES = ['compact', 'clear', 'guardrail'] as const;
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

type Errors = ValidationError[];

function own(record: object, key: unknown): boolean {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(record, key);
}

function speciesOf(id: string): SpeciesDef | null {
  return own(SPECIES, id) ? (SPECIES[id as keyof typeof SPECIES] as SpeciesDef) : null;
}

function knowsMove(species: SpeciesDef, moveId: string): boolean {
  return species.signature === moveId || species.moves.includes(moveId as never);
}

function isUniversal(moveId: string): boolean {
  return MOVES[moveId as keyof typeof MOVES].universal === true;
}

function inRange(n: number, min: number, max: number): boolean {
  return Number.isSafeInteger(n) && n >= min && n <= max;
}

/**
 * One move id, listed or from a grid piece: unknownId, universalListed, duplicateMove, then moveNotKnown
 * (`known` decides; it also covers a piece with no moveId).
 */
function checkMove(moveId: string | undefined, path: string, seen: Set<string>, known: (id: string) => boolean, errors: Errors): void {
  if (moveId === undefined) {
    errors.push({ code: 'moveNotKnown', path, message: 'piece has no moveId' });
    return;
  }
  if (!own(MOVES, moveId)) errors.push({ code: 'unknownId', path, message: `unknown move ${String(moveId)}` });
  else if (isUniversal(moveId)) errors.push({ code: 'universalListed', path, message: `${moveId} is universal and must not be listed` });
  else if (seen.has(moveId)) errors.push({ code: 'duplicateMove', path, message: `duplicate move ${moveId}` });
  else if (!known(moveId)) errors.push({ code: 'moveNotKnown', path, message: `${moveId} is not known here` });
  seen.add(moveId);
}

function isGridMovePiece(p: PlacedPiece): boolean {
  return p.kind === 'skill' || p.kind === 'graft';
}

/** A gridded orchestrator's moves: Skills must be known by its species; grafts must be some species' signature. */
function validateGridMoves(species: SpeciesDef | null, grid: GridLayout, id: SideId, errors: Errors): void {
  const seen = new Set<string>(species === null ? [] : [species.signature]);
  grid.pieces.forEach((p, j) => {
    if (!isGridMovePiece(p)) return;
    const known =
      p.kind === 'graft'
        ? (m: string) => SIGNATURE_MOVE_IDS.includes(m as never)
        : (m: string) => species === null || knowsMove(species, m);
    checkMove(p.moveId, `${id}.grid.pieces[${j}].moveId`, seen, known, errors);
  });
}

function validateCreature(c: CreatureSetup, path: string, role: 'orchestrator' | 'subagent', gridded: boolean, ids: Set<string>, errors: Errors): void {
  if (ids.has(c.id)) errors.push({ code: 'duplicateId', path: `${path}.id`, message: `duplicate creature id ${c.id}` });
  ids.add(c.id);
  const species = speciesOf(c.species);
  if (species === null) errors.push({ code: 'unknownId', path: `${path}.species`, message: `unknown species ${String(c.species)}` });
  if (!inRange(c.level, 1, 100)) errors.push({ code: 'level', path: `${path}.level`, message: `level must be an integer in 1..100, got ${String(c.level)}` });
  if (!VERSIONS.includes(c.version)) errors.push({ code: 'version', path: `${path}.version`, message: `unknown version ${String(c.version)}` });
  if (c.generalization !== undefined && !inRange(c.generalization, 0, 100)) {
    errors.push({ code: 'range', path: `${path}.generalization`, message: `generalization must be an integer in 0..100, got ${String(c.generalization)}` });
  }
  if (c.trainedTemperature !== undefined && !inRange(c.trainedTemperature, 0, 4)) {
    errors.push({ code: 'range', path: `${path}.trainedTemperature`, message: `trainedTemperature must be an integer in 0..4, got ${String(c.trainedTemperature)}` });
  }
  if (role === 'orchestrator' && gridded) {
    if (c.moves.length > 0) errors.push({ code: 'movesFromGrid', path: `${path}.moves`, message: 'a gridded orchestrator lists no moves; they come from its grid' });
    return;
  }
  const seen = new Set<string>();
  c.moves.forEach((m, i) => checkMove(m, `${path}.moves[${i}]`, seen, (id) => species === null || knowsMove(species, id), errors));
  const listed = c.moves.filter((m) => !own(MOVES, m) || !isUniversal(m)).length;
  if (role === 'subagent' && listed > MAX_MOVES) {
    errors.push({ code: 'moveCount', path: `${path}.moves`, message: `at most ${MAX_MOVES} moves, got ${listed}` });
  }
}

function slotPieces(grid: GridLayout): { piece: PlacedPiece; at: number }[] {
  const out: { piece: PlacedPiece; at: number }[] = [];
  grid.pieces.forEach((piece, at) => {
    if (piece.kind === 'subagentSlot') out.push({ piece, at });
  });
  return out;
}

/** Each active subagent binds to the one Subagent Slot piece whose subagentId is its creature id. */
function validateSlots(side: SideSetup, grid: GridLayout, id: SideId, errors: Errors): void {
  const slots = slotPieces(grid);
  const activeIds = side.active.map((c) => c.id);
  side.active.forEach((c, i) => {
    if (!slots.some((s) => s.piece.subagentId === c.id)) {
      errors.push({ code: 'slotBinding', path: `${id}.active[${i}]`, message: `no Subagent Slot piece holds ${c.id}` });
    }
  });
  const named = new Set<string>();
  for (const { piece, at } of slots) {
    const sub = piece.subagentId;
    if (sub === undefined) continue;
    const path = `${id}.grid.pieces[${at}]`;
    if (named.has(sub)) errors.push({ code: 'slotBinding', path, message: `${piece.id} names ${sub}, already held by another slot` });
    else if (!activeIds.includes(sub)) errors.push({ code: 'slotBinding', path, message: `${piece.id} names ${sub}, which is not an active creature on side ${id}` });
    named.add(sub);
  }
  if (slots.length > MAX_ACTIVE) {
    errors.push({ code: 'slotBinding', path: `${id}.grid.pieces`, message: `at most ${MAX_ACTIVE} Subagent Slot pieces, found ${slots.length}` });
  }
  if (side.active.length > slots.length) {
    errors.push({ code: 'slotBinding', path: `${id}.active`, message: `${side.active.length} active subagents but ${slots.length} Subagent Slot pieces` });
  }
}

function validateSide(side: SideSetup, id: SideId, ids: Set<string>, errors: Errors): void {
  const gridded = side.grid !== null;
  validateCreature(side.orchestrator, `${id}.orchestrator`, 'orchestrator', gridded, ids, errors);
  side.active.forEach((c, i) => validateCreature(c, `${id}.active[${i}]`, 'subagent', gridded, ids, errors));
  if (side.active.length > MAX_ACTIVE) {
    errors.push({ code: 'activeCount', path: `${id}.active[${MAX_ACTIVE}]`, message: `at most ${MAX_ACTIVE} active subagents, got ${side.active.length}` });
  }
  side.bench.forEach((c, i) => validateCreature(c, `${id}.bench[${i}]`, 'subagent', gridded, ids, errors));
  if (side.bench.length > MAX_BENCH) {
    errors.push({ code: 'benchCount', path: `${id}.bench[${MAX_BENCH}]`, message: `at most ${MAX_BENCH} bench creatures, got ${side.bench.length}` });
  }
  if (side.grid !== null) {
    for (const e of validateGrid(side.grid, side.orchestrator.level).errors) {
      errors.push({ code: e.code, path: `${id}.grid.${e.path}`, message: e.message });
    }
    validateGridMoves(speciesOf(side.orchestrator.species), side.grid, id, errors);
    validateSlots(side, side.grid, id, errors);
  }
  if (side.autopilot !== undefined && !inRange(side.autopilot.temperature, 0, 4)) {
    errors.push({ code: 'range', path: `${id}.autopilot.temperature`, message: `temperature must be an integer in 0..4, got ${String(side.autopilot.temperature)}` });
  }
}

/** Every problem with a setup, as `{ code, path, message }`, in side order (A then B). */
export function validateSetup(setup: BattleSetup): ValidationResult {
  const errors: Errors = [];
  const ids = new Set<string>();
  validateSide(setup.a, 'a', ids, errors);
  validateSide(setup.b, 'b', ids, errors);
  return { ok: errors.length === 0, errors };
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
  const orchMoves =
    grid === null ? side.orchestrator.moves : [orchSpecies.signature, ...grid.pieces.filter(isGridMovePiece).map((p) => p.moveId as string)];
  creatures.push(buildCreature(side.orchestrator, creatures.length, id, { slot: 'orchestrator', activeSlot: null, benchOrder: null }, orchWindow, orchMoves));
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
  const a = addSide(creatures, setup.a, 'a');
  const b = addSide(creatures, setup.b, 'b');
  return { round: 0, seed, rng: seedRng(parsed.words), creatures, sides: { a, b }, fields: [], handoff: [], ended: false, result: null };
}
