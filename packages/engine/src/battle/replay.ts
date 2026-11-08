import { parseSeed } from '../rng/seed.js';
import { ENGINE_VERSION, type BattleLog } from './log.js';
import { validateSetup } from './setup.js';
import { setupShapeErrors } from './setup-shape.js';
import { isNum, isRecord, isStr, type Rec } from './shape.js';
import { runBattle, type BattleResult } from './simulate.js';

/**
 * Why a log cannot be replayed (Rulings 68-70, 75). `malformed`: not shaped like a BattleLog (see
 * wellFormed), a seed parseSeed rejects, a recorded round command submitRound rejects (including any round
 * logged after the battle ended), or rounds that run out before the battle ends (Ruling 70). `version`:
 * written by another ENGINE_VERSION (re-simulation policy is sub-project 5's). `invalidSetup`: a
 * well-shaped setup that validateSetup rejects.
 */
export type ReplayError = { code: 'version' | 'malformed' | 'invalidSetup' };

const records = (v: unknown, ok: (x: Rec) => boolean): boolean => Array.isArray(v) && v.every((x) => isRecord(x) && ok(x));

/** A side command's temperature must be a number (validateCommand checks its range and the action). */
function roundOk(r: Rec): boolean {
  return [r.a, r.b].every((sc) => sc === undefined || (isRecord(sc) && isNum(sc.temperature)));
}

/**
 * Shaped like a BattleLog: a string engineVersion and seed, rounds an array of round records, and a setup
 * with no shape errors — the same checks validateSetup runs first (setupShapeErrors, Ruling 75).
 */
function wellFormed(log: unknown): log is BattleLog {
  if (!isRecord(log) || !isStr(log.engineVersion) || !isStr(log.seed) || !records(log.rounds, roundOk)) return false;
  return setupShapeErrors(log.setup).length === 0;
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
