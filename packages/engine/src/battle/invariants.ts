import { DRIFT_CAP } from '../context/store.js';
import { EngineInvariantError } from '../math/bp.js';
import type { BattleState } from './state.js';

const STAGE_MIN = -3;
const STAGE_MAX = 3;

/**
 * Engine-bug checks that run in every build (spec §7): canonical indices match array positions,
 * HP within [0, maxHp], tokens within the window, Drift 0..5 and stat stages -3..3. Throws
 * EngineInvariantError carrying the round and the offending creature's canonical index.
 */
export function assertInvariants(state: BattleState): void {
  for (let i = 0; i < state.creatures.length; i++) {
    const c = state.creatures[i];
    if (c === undefined) throw new EngineInvariantError(`creature ${i} is missing`, { round: state.round, actor: i });
    const fail = (what: string): never => {
      throw new EngineInvariantError(`creature ${i} (${c.id}): ${what}`, { round: state.round, actor: i });
    };
    if (c.index !== i) fail(`canonical index ${c.index} does not match position ${i}`);
    if (!Number.isSafeInteger(c.maxHp) || c.maxHp < 1) fail(`maxHp ${c.maxHp} is not a positive integer`);
    if (!Number.isSafeInteger(c.hp) || c.hp < 0 || c.hp > c.maxHp) fail(`hp ${c.hp} outside [0, ${c.maxHp}]`);
    if (c.context.tokens.length > c.context.window) fail(`${c.context.tokens.length} tokens exceed window ${c.context.window}`);
    if (!Number.isSafeInteger(c.context.drift) || c.context.drift < 0 || c.context.drift > DRIFT_CAP) {
      fail(`drift ${c.context.drift} outside 0..${DRIFT_CAP}`);
    }
    for (const [stat, stage] of Object.entries(c.stages)) {
      if (!Number.isSafeInteger(stage) || stage < STAGE_MIN || stage > STAGE_MAX) fail(`${stat} stage ${stage} outside ${STAGE_MIN}..${STAGE_MAX}`);
    }
  }
}
