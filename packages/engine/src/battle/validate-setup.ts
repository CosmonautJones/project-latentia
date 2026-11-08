import { MOVES, SIGNATURE_MOVE_IDS } from '../content/moves.js';
import { SPECIES, type SpeciesDef } from '../content/species.js';
import type { GridLayout, PlacedPiece } from '../grid/model.js';
import { validateGrid, type ValidationResult } from '../grid/validate.js';
import type { BattleSetup, CreatureSetup, SideSetup, ValidationError } from './setup.js';
import { setupShapeErrors } from './setup-shape.js';
import { autopilotDeckErrors, deckErrors } from './validate-deck.js';
import { VERSIONS, type SideId } from './state.js';

// validateSetup (spec §7 "Invalid setup or grid"): every problem as { code, path, message }.

export const MAX_ACTIVE = 2;
export const MAX_BENCH = 3;
/** Most non-universal moves a subagent may list. */
export const MAX_MOVES = 4;

type Errors = ValidationError[];

export function own(record: object, key: unknown): boolean {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(record, key);
}

export function speciesOf(id: string): SpeciesDef | null {
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

export function isGridMovePiece(p: PlacedPiece): boolean {
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

export function slotPieces(grid: GridLayout): { piece: PlacedPiece; at: number }[] {
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

/**
 * Each creature's deck against its stored moveset (Ruling 82): a gridded orchestrator's comes from its grid
 * (species signature, then its Skill and graft moves); everyone else's is its listed moves. Universals are known.
 * The side's Autopilot deck is checked against the orchestrator's moveset, with its card cap (Ruling 95).
 */
function validateDecks(side: SideSetup, id: SideId, errors: Errors): void {
  const orch = side.orchestrator;
  const orchSpecies = speciesOf(orch.species);
  const orchMoves =
    side.grid === null ? orch.moves : [...(orchSpecies === null ? [] : [orchSpecies.signature]), ...side.grid.pieces.flatMap((p) => (isGridMovePiece(p) && p.moveId !== undefined ? [p.moveId] : []))];
  const all: [CreatureSetup, string, readonly string[]][] = [
    [orch, `${id}.orchestrator`, orchMoves],
    ...side.active.map((c, i): [CreatureSetup, string, readonly string[]] => [c, `${id}.active[${i}]`, c.moves]),
    ...side.bench.map((c, i): [CreatureSetup, string, readonly string[]] => [c, `${id}.bench[${i}]`, c.moves]),
  ];
  for (const [c, path, known] of all) if (c.deck !== undefined) deckErrors(c.deck, `${path}.deck`, known, errors);
  if (side.autopilot !== undefined) autopilotDeckErrors(side.autopilot.deck, `${id}.autopilot.deck`, orchMoves, errors);
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
  validateDecks(side, id, errors);
  if (side.autopilot !== undefined && !inRange(side.autopilot.temperature, 0, 4)) {
    errors.push({ code: 'range', path: `${id}.autopilot.temperature`, message: `temperature must be an integer in 0..4, got ${String(side.autopilot.temperature)}` });
  }
}

/**
 * Every problem with a setup, as `{ code, path, message }`, in side order (A then B). Safe on untrusted
 * JSON (Ruling 75): a setup of the wrong shape returns only its `shape` errors (setupShapeErrors) — values
 * cannot be checked on it — and nothing here throws.
 */
export function validateSetup(input: unknown): ValidationResult {
  const shape = setupShapeErrors(input);
  if (shape.length > 0) return { ok: false, errors: shape };
  const setup = input as BattleSetup;
  const errors: Errors = [];
  const ids = new Set<string>();
  validateSide(setup.a, 'a', ids, errors);
  validateSide(setup.b, 'b', ids, errors);
  return { ok: errors.length === 0, errors };
}

