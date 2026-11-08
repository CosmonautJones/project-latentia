import { STAGE_MAX, STAGE_MIN, STAGE_STATS, type NonPassiveEffect } from '../../content/primitives.js';
import type { BattleEvent } from '../../events/types.js';
import type { Token } from '../../context/store.js';
import type { CreatureState } from '../state.js';
import { recipients, type EffectContext } from './context.js';

export type StageEffect = Extract<NonPassiveEffect, { kind: 'stage' }>;

// STAGE_STATS lives with StageStat in content/primitives.ts (shared with generalization/); re-exported for the effects.
export { STAGE_STATS };

/**
 * Moves `c`'s `stat` stage by `delta`, clamped to −3…+3. Emits one StageChanged with the change actually
 * made and the new stage, or nothing when the stage did not move.
 */
export function changeStage(c: CreatureState, stat: string, delta: number, round: number, events: BattleEvent[]): void {
  const before = c.stages[stat] ?? 0;
  const after = Math.max(STAGE_MIN, Math.min(STAGE_MAX, before + delta));
  if (after === before) return;
  c.stages[stat] = after;
  events.push({ round, type: 'StageChanged', target: c.index, stat, delta: after - before, stageAfter: after });
}

/** Sets every stage (`all`) or every positive stage (`positive`) of `c` to 0, in STAGE_STATS order. */
export function clearStages(c: CreatureState, which: 'all' | 'positive', round: number, events: BattleEvent[]): void {
  for (const stat of STAGE_STATS) {
    const v = c.stages[stat] ?? 0;
    if (v > 0 || (which === 'all' && v < 0)) changeStage(c, stat, -v, round, events);
  }
}

/**
 * The buff tag for a move's cost tokens (spec §5 Context, Ruling 47): the first effect in the list that
 * raises a stage of the user (`self`, `allAllies` or `everyone`), as `{ stat, stages }`; none otherwise.
 */
export function buffTag(effects: readonly NonPassiveEffect[]): Token['buff'] {
  for (const e of effects) {
    if (e.kind === 'stage' && e.op === 'add' && e.delta > 0 && e.who !== 'target' && e.who !== 'allFoes') return { stat: e.stat, stages: e.delta };
  }
  return undefined;
}

/**
 * A summarized buff token costs its buff 1 stage ("the details got blurry"): the stat drops by 1 if it is
 * still positive; a stage at or below 0 is left alone.
 */
export function loseSummarizedBuff(c: CreatureState, stat: string, round: number, events: BattleEvent[]): void {
  if ((c.stages[stat] ?? 0) > 0) changeStage(c, stat, -1, round, events);
}

/** `stage`: add `delta` to `stat` (clamped −3…+3), or clear all / positive stages, on every recipient. */
export function applyStage(ctx: EffectContext, effect: StageEffect): void {
  for (const c of recipients(ctx, effect.who)) {
    if (effect.op === 'add') changeStage(c, effect.stat, effect.delta, ctx.round, ctx.events);
    else clearStages(c, effect.which, ctx.round, ctx.events);
  }
}
