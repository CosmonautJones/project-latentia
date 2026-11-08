import { gridShapeErrors } from '../grid/validate.js';
import type { ValidationError } from './setup.js';
import { deckShapeErrors } from './validate-deck.js';

// Shape checks for untrusted JSON (Ruling 75, reversing Ruling 29): validateSetup runs these first and
// replay reuses them, so no malformed setup or log can make a validator, createBattle or replay throw.
// They check types only; values (ranges, ids, counts) are validateSetup's.

export type Rec = Record<string, unknown>;

export const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isStr = (v: unknown): v is string => typeof v === 'string';
export const isNum = (v: unknown): v is number => typeof v === 'number';

export const SETUP_KINDS = ['trainer', 'wild', 'ghost'] as const;

type Errors = ValidationError[];

const shape = (errors: Errors, path: string, message: string): void => {
  errors.push({ code: 'shape', path, message });
};

/** `path.key`; '' on either side is the root, so it adds nothing. */
const join = (path: string, key: string): string => (path === '' ? key : key === '' ? path : `${path}.${key}`);

/** An array (no holes) whose every entry passes `entry`; reports the array or each bad entry. */
function arrayOf(v: unknown, path: string, what: string, errors: Errors, entry: (x: unknown, at: string) => void): void {
  if (!Array.isArray(v)) {
    shape(errors, path, `${what} must be an array`);
    return;
  }
  for (let i = 0; i < v.length; i++) entry(v[i], `${path}[${i}]`);
}

function field(c: Rec, key: string, path: string, ok: (v: unknown) => boolean, what: string, errors: Errors): void {
  if (!ok(c[key])) shape(errors, join(path, key), `${key} must be ${what}`);
}

function creatureShape(c: unknown, path: string, errors: Errors): void {
  if (!isRecord(c)) {
    shape(errors, path, 'a creature must be an object');
    return;
  }
  field(c, 'id', path, isStr, 'a string', errors);
  field(c, 'species', path, isStr, 'a string', errors);
  field(c, 'level', path, isNum, 'a number', errors);
  field(c, 'version', path, isStr, 'a string', errors);
  arrayOf(c.moves, join(path, 'moves'), 'moves', errors, (m, at) => {
    if (!isStr(m)) shape(errors, at, 'a move id must be a string');
  });
  field(c, 'generalization', path, (v) => v === undefined || isNum(v), 'a number when present', errors);
  field(c, 'trainedTemperature', path, (v) => v === undefined || isNum(v), 'a number when present', errors);
  if (c.recordedFoes !== undefined) {
    arrayOf(c.recordedFoes, join(path, 'recordedFoes'), 'recordedFoes', errors, (f, at) => {
      if (!isStr(f)) shape(errors, at, 'a recorded foe id must be a string');
    });
  }
  if (c.deck !== undefined) deckShapeErrors(c.deck, join(path, 'deck'), errors);
}

function sideShape(s: unknown, path: string, errors: Errors): void {
  if (!isRecord(s)) {
    shape(errors, path, 'a side must be an object');
    return;
  }
  creatureShape(s.orchestrator, join(path, 'orchestrator'), errors);
  arrayOf(s.active, join(path, 'active'), 'active', errors, (c, at) => creatureShape(c, at, errors));
  arrayOf(s.bench, join(path, 'bench'), 'bench', errors, (c, at) => creatureShape(c, at, errors));
  const gridPath = join(path, 'grid');
  if (s.grid !== null) {
    if (s.grid === undefined) shape(errors, gridPath, 'grid must be a grid or null');
    else for (const e of gridShapeErrors(s.grid)) errors.push({ code: e.code, path: join(gridPath, e.path), message: e.message });
  }
  if (s.autopilot !== undefined) {
    if (!isRecord(s.autopilot)) shape(errors, join(path, 'autopilot'), 'autopilot must be an object when present');
    else field(s.autopilot, 'temperature', join(path, 'autopilot'), isNum, 'a number', errors);
  }
  field(s, 'opponentId', path, isStr, 'a string', errors);
}

/**
 * Every type-level problem with an untrusted setup, as code `shape` with a path ('' is the setup itself),
 * side A then side B then `kind`. Messages never print the offending value. Never throws.
 */
export function setupShapeErrors(setup: unknown): ValidationError[] {
  const errors: Errors = [];
  if (!isRecord(setup)) {
    shape(errors, '', 'a setup must be an object');
    return errors;
  }
  sideShape(setup.a, 'a', errors);
  sideShape(setup.b, 'b', errors);
  if (!SETUP_KINDS.includes(setup.kind as never)) shape(errors, 'kind', `kind must be one of ${SETUP_KINDS.join(', ')}`);
  return errors;
}
