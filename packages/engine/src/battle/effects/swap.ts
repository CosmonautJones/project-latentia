import type { StatusId } from '../../content/ids.js';
import type { NonPassiveEffect } from '../../content/primitives.js';
import type { BattleEvent } from '../../events/types.js';
import { EngineInvariantError } from '../../math/bp.js';
import { cureStatus } from '../../status/apply.js';
import { benchOf, renumber, sideNumber } from '../end.js';
import { holdsLiveSlot } from '../order.js';
import type { BattleState, CreatureState } from '../state.js';
import { creature, type EffectContext } from './context.js';

export type FieldSlotEffect = Extract<NonPassiveEffect, { kind: 'reorder'; what: 'fieldSlot' }>;

/** Leaving the field cures these (bible: Overfit "switching out cures it", Deprecated "swapping out clears it"; Ruling 19). */
const CURED_ON_LEAVING: readonly StatusId[] = ['overfit', 'deprecated', 'promptInjected'];

/** A creature leaving the field: the statuses above are cured (StatusCured), and its charge and guard drop. */
function leaveField(c: CreatureState, round: number, events: BattleEvent[]): void {
  for (const id of CURED_ON_LEAVING) events.push(...cureStatus(c, id, round));
  c.charging = null;
  c.guard = null;
}

function slotIndexOf(state: BattleState, c: CreatureState): 0 | 1 {
  if (c.activeSlot === null) throw new EngineInvariantError(`creature ${c.index} has no active slot to leave`, { round: state.round, actor: c.index, seed: state.seed });
  return c.activeSlot;
}

/**
 * Exchanges an active creature `out` (its slot not removed) with the living bench creature `inc`: `inc`
 * takes the slot, `out` takes `inc`'s bench position, and the bench is renumbered. Emits Swapped. A no-op
 * (returns false, emits nothing) when either is no longer in place — e.g. `inc` was already brought in
 * earlier this round. The swapped-in creature has no entry this round, so it does not act until the next.
 */
export function swapCreatures(state: BattleState, outIndex: number, inIndex: number, round: number, events: BattleEvent[]): boolean {
  const ref = { state, round };
  const out = creature(ref, outIndex);
  const inc = creature(ref, inIndex);
  if (!holdsLiveSlot(state, out) || inc.slot !== 'bench' || inc.fainted || inc.side !== out.side) return false;
  const i = slotIndexOf(state, out);
  const bench = benchOf(state, out.side);
  bench.splice(bench.indexOf(inc), 1, out);
  leaveField(out, round, events);
  out.slot = 'bench';
  out.activeSlot = null;
  inc.slot = 'active';
  inc.activeSlot = i;
  inc.benchOrder = null;
  const slot = state.sides[out.side].slots[i];
  if (slot !== undefined) slot.occupant = inc.index;
  renumber(bench);
  events.push({ round, type: 'Swapped', side: sideNumber(out.side), outIndex: out.index, inIndex: inc.index });
  return true;
}

/**
 * Force-benching (spec §5 Context: a compacted Subagent Slot, or Deprecated at 0): the active creature
 * leaves its slot, which is left empty, and goes to the END of the bench (which may exceed 3). Emits
 * Swapped with `inIndex: -1`; end-of-round auto-fill refills the slot unless it was removed.
 */
export function forceBench(state: BattleState, c: CreatureState, round: number, events: BattleEvent[]): void {
  const i = slotIndexOf(state, c);
  const bench = benchOf(state, c.side);
  leaveField(c, round, events);
  c.slot = 'bench';
  c.activeSlot = null;
  bench.push(c);
  renumber(bench);
  const slot = state.sides[c.side].slots[i];
  if (slot !== undefined) slot.occupant = null;
  events.push({ round, type: 'Swapped', side: sideNumber(c.side), outIndex: c.index, inIndex: -1 });
}

/** The first living creature in a side's bench order, or null. */
export function firstLivingBench(state: BattleState, c: CreatureState): CreatureState | null {
  return benchOf(state, c.side).find((b) => !b.fainted) ?? null;
}

/**
 * `reorder fieldSlot` (Early Exit, Ruling 9): the user swaps out for the first living bench creature, by
 * the same path as the Swap lever (it resolves within the user's +3 action). A no-op for an orchestrator
 * (never benched), a KO'd user, or with no living bench creature.
 */
export function applySwap(ctx: EffectContext, effect: FieldSlotEffect): void {
  const user = creature(ctx, ctx.actor);
  if (effect.incoming !== 'firstLivingBench' || user.isOrchestrator || user.fainted) return;
  const inc = firstLivingBench(ctx.state, user);
  if (inc !== null) swapCreatures(ctx.state, user.index, inc.index, ctx.round, ctx.events);
}
