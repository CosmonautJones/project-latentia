import { parseSeed } from '../rng/seed.js';
import { ENGINE_VERSION, type BattleLog } from './log.js';
import { validateSetup } from './setup.js';
import { runBattle, type BattleResult } from './simulate.js';

/**
 * Why a log cannot be replayed (Ruling 29). `malformed`: not shaped like a BattleLog (see wellFormed), a
 * seed parseSeed rejects, a recorded round command submitRound rejects (including any round logged after
 * the battle ended), or rounds that run out before the battle ends (Ruling 70). `version`: written by another ENGINE_VERSION (re-simulation policy is sub-project 5's).
 * `invalidSetup`: a well-formed setup that validateSetup rejects.
 */
export type ReplayError = { code: 'version' | 'malformed' | 'invalidSetup' };

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number';
const optional = (v: unknown, ok: (x: unknown) => boolean): boolean => v === undefined || ok(v);
const strings = (v: unknown): boolean => Array.isArray(v) && v.every(isStr);
const records = (v: unknown, ok: (x: Rec) => boolean): boolean => Array.isArray(v) && v.every((x) => isRecord(x) && ok(x));

// The shape checks cover every field validateSetup, validateGrid, createBattle and validateCommand read
// without a type guard of their own (validateSetup assumes well-formed input, Ruling 29), so nothing a
// malformed log holds can make them throw. Values are range-checked by those validators, not here.

function creatureOk(c: Rec): boolean {
  return (
    isStr(c.id) &&
    isStr(c.species) &&
    isNum(c.level) &&
    isStr(c.version) &&
    strings(c.moves) &&
    optional(c.generalization, isNum) &&
    optional(c.trainedTemperature, isNum) &&
    optional(c.recordedFoes, strings)
  );
}

function pieceOk(p: Rec): boolean {
  return isStr(p.id) && isStr(p.kind) && optional(p.moveId, isStr) && optional(p.subagentId, isStr);
}

function gridOk(g: unknown): boolean {
  return g === null || (isRecord(g) && isNum(g.width) && isNum(g.height) && records(g.pieces, pieceOk));
}

function sideOk(s: unknown): boolean {
  return (
    isRecord(s) &&
    isRecord(s.orchestrator) &&
    creatureOk(s.orchestrator) &&
    records(s.active, creatureOk) &&
    records(s.bench, creatureOk) &&
    gridOk(s.grid) &&
    optional(s.autopilot, (a) => isRecord(a) && isNum(a.temperature)) &&
    isStr(s.opponentId)
  );
}

/** A side command's temperature must be a number (validateCommand checks its range and the action). */
function roundOk(r: Rec): boolean {
  return [r.a, r.b].every((sc) => sc === undefined || (isRecord(sc) && isNum(sc.temperature)));
}

function wellFormed(log: unknown): log is BattleLog {
  if (!isRecord(log) || !isStr(log.engineVersion) || !isStr(log.seed) || !records(log.rounds, roundOk)) return false;
  const setup = log.setup;
  return isRecord(setup) && sideOk(setup.a) && sideOk(setup.b) && (setup.kind === 'trainer' || setup.kind === 'wild' || setup.kind === 'ghost');
}

const fail = (code: ReplayError['code']): { error: ReplayError } => ({ error: { code } });

/**
 * Re-runs a logged battle (spec §4, §5 "Events, logs and hashing"): the same setup and seed, the logged
 * round commands re-submitted in order. Returns the BattleResult — same events and hash as the recorded
 * battle — or a typed ReplayError; never throws for any input. The version is checked first, on the
 * smallest shape that carries it (Ruling 69), so a log from another version is `version` whatever else it
 * holds. Rounds are never padded (Ruling 70): a log whose rounds run out before the battle ends is
 * `malformed`, as is one with rounds after the end. Does not modify the log.
 */
export function replay(log: BattleLog): BattleResult | { error: ReplayError } {
  const raw: unknown = log;
  if (isRecord(raw) && isStr(raw.engineVersion) && raw.engineVersion !== ENGINE_VERSION) return fail('version');
  if (!wellFormed(raw)) return fail('malformed');
  if (!parseSeed(raw.seed).ok) return fail('malformed');
  if (!validateSetup(raw.setup).ok) return fail('invalidSetup');
  const rounds = raw.rounds;
  const result = runBattle(raw.setup, raw.seed, (state) => rounds[state.round] ?? null);
  // A logged round after the battle ended is one submitRound would reject (battleEnded).
  return 'error' in result || rounds.length > result.rounds ? fail('malformed') : result;
}
