import { DRIFT_CAP } from '../context/store.js';
import { EngineInvariantError } from '../math/bp.js';
import type { BattleState, CreatureState, SideId } from './state.js';

const STAGE_MIN = -3;
const STAGE_MAX = 3;
const SLOTS = 2;

function placementError(c: CreatureState): string | null {
  if (c.isOrchestrator !== (c.slot === 'orchestrator')) return `isOrchestrator ${String(c.isOrchestrator)} disagrees with slot ${c.slot}`;
  if (c.slot === 'orchestrator' && (c.activeSlot !== null || c.benchOrder !== null)) return 'an orchestrator has no activeSlot or benchOrder';
  if (c.slot === 'active' && (c.activeSlot === null || c.benchOrder !== null)) return 'an active creature has an activeSlot and no benchOrder';
  if (c.slot === 'bench' && (c.activeSlot !== null || c.benchOrder === null || !Number.isSafeInteger(c.benchOrder) || c.benchOrder < 0)) {
    return 'a bench creature has a non-negative benchOrder and no activeSlot';
  }
  return null;
}

/**
 * Engine-bug checks that run in every build (spec §7). Per creature: canonical index = array position,
 * HP within [0, maxHp], fainted iff HP is 0, tokens within the window, Drift 0..5, stages -3..3, a slot
 * that agrees with activeSlot / benchOrder / isOrchestrator, and at most one shield per kind with a positive
 * count. Timed fields name real creatures and have rounds left; no turn order is pending. Per side: exactly one orchestrator,
 * each activeSlot held at most once, and `slots[i].occupant` is the creature holding activeSlot i.
 * Throws EngineInvariantError with the round, seed and (when one is to blame) the canonical index.
 */
export function assertInvariants(state: BattleState): void {
  const fail = (what: string, actor?: number): never => {
    const ctx = actor === undefined ? { round: state.round, seed: state.seed } : { round: state.round, actor, seed: state.seed };
    throw new EngineInvariantError(what, ctx);
  };

  for (let i = 0; i < state.creatures.length; i++) {
    const c = state.creatures[i];
    if (c === undefined) return fail(`creature ${i} is missing`, i);
    const bad = (what: string): never => fail(`creature ${i} (${c.id}): ${what}`, i);
    if (c.index !== i) bad(`canonical index ${c.index} does not match position ${i}`);
    if (!Number.isSafeInteger(c.maxHp) || c.maxHp < 1) bad(`maxHp ${c.maxHp} is not a positive integer`);
    if (!Number.isSafeInteger(c.hp) || c.hp < 0 || c.hp > c.maxHp) bad(`hp ${c.hp} outside [0, ${c.maxHp}]`);
    if (c.fainted !== (c.hp === 0)) bad(`fainted ${String(c.fainted)} with hp ${c.hp}`);
    if (c.context.tokens.length > c.context.window) bad(`${c.context.tokens.length} tokens exceed window ${c.context.window}`);
    if (!Number.isSafeInteger(c.context.drift) || c.context.drift < 0 || c.context.drift > DRIFT_CAP) {
      bad(`drift ${c.context.drift} outside 0..${DRIFT_CAP}`);
    }
    for (const [stat, stage] of Object.entries(c.stages)) {
      if (!Number.isSafeInteger(stage) || stage < STAGE_MIN || stage > STAGE_MAX) bad(`${stat} stage ${stage} outside ${STAGE_MIN}..${STAGE_MAX}`);
    }
    const placement = placementError(c);
    if (placement !== null) bad(placement);
    const kinds = new Set(c.shields.map((x) => x.against));
    if (kinds.size !== c.shields.length || c.shields.some((x) => !Number.isSafeInteger(x.count) || x.count < 1)) bad('shields must be one per kind with a positive count');
  }

  for (const f of state.fields) {
    const known = (i: number) => Number.isSafeInteger(i) && state.creatures[i] !== undefined;
    if (!known(f.target) || !known(f.source)) fail(`field ${f.effect.kind} names an unknown creature`);
    if (!Number.isSafeInteger(f.remaining) || f.remaining < 1) fail(`field ${f.effect.kind} on ${f.target} has ${f.remaining} rounds left`, f.target);
  }
  if (state.turnOrder.length > 0) fail(`turn order not empty between rounds: ${state.turnOrder.join(',')}`);

  const sides: SideId[] = ['a', 'b'];
  for (const id of sides) {
    let orchestrators = 0;
    const holders: (number | null)[] = [null, null];
    for (const c of state.creatures) {
      if (c.side !== id) continue;
      if (c.slot === 'orchestrator') {
        orchestrators++;
        if (orchestrators > 1) fail(`side ${id} has more than one orchestrator`, c.index);
      }
      if (c.activeSlot !== null) {
        if (holders[c.activeSlot] !== null) fail(`side ${id} activeSlot ${c.activeSlot} is held twice`, c.index);
        holders[c.activeSlot] = c.index;
      }
    }
    if (orchestrators !== 1) fail(`side ${id} has no orchestrator`);
    const slots = state.sides[id].slots;
    if (slots.length !== SLOTS) fail(`side ${id} has ${slots.length} slots, expected ${SLOTS}`);
    for (let s = 0; s < SLOTS; s++) {
      const occupant = slots[s]?.occupant ?? null;
      const holder = holders[s] ?? null;
      if (occupant !== holder) {
        fail(`side ${id} slot ${s} occupant ${String(occupant)} but activeSlot ${s} is held by ${String(holder)}`, holder ?? occupant ?? undefined);
      }
    }
  }
}
