import { moveDef } from '../../content/moves.js';
import type { MoveDef, NonPassiveEffect } from '../../content/primitives.js';
import { hi } from '../../rng/draws.js';
import { creature, type EffectContext } from './context.js';
import { changeStage, STAGE_STATS } from './stage.js';
import { highestPositive } from './stealStage.js';

export type CopyEffect = Extract<NonPassiveEffect, { kind: 'copy' }>;
export type CopyBuffEffect = Extract<CopyEffect, { what: 'buff' }>;
export type CopyMoveEffect = Extract<CopyEffect, { what: 'move' }>;

/** A move whose effects copy a move (Episodic Replay, Stochastic Repeat). A copy never re-uses one of these. */
export function copiesMove(def: MoveDef): boolean {
  return [def.effects, def.wild ?? [], def.wildT4 ?? []].some((list) => list.some((e) => e.kind === 'copy' && e.what === 'move'));
}

/**
 * `copy` of a buff (Ruling 58), from the living target to the user:
 * - Fork (`best`, `copy`): the target's highest positive stage (ties in STAGE_STATS order); the user's stage
 *   of that stat rises to it (a copy never lowers the user's own stage).
 * - Merge Conflict (`random`, `swap`): one of the target's positive stages, picked by hi(D6, count) over them
 *   in STAGE_STATS order; the user and the target exchange their stages of that stat.
 */
export function applyCopyBuff(ctx: EffectContext, effect: CopyBuffEffect): void {
  const user = creature(ctx, ctx.actor);
  const target = creature(ctx, ctx.target);
  if (target.fainted || user.fainted || target.index === user.index) return;
  if (effect.mode === 'copy') {
    const stat = highestPositive(target);
    if (stat === null) return;
    const gain = (target.stages[stat] ?? 0) - (user.stages[stat] ?? 0);
    if (gain > 0) changeStage(user, stat, gain, ctx.round, ctx.events);
    return;
  }
  const positives = STAGE_STATS.filter((s) => (target.stages[s] ?? 0) > 0);
  const stat = positives.length === 0 ? undefined : positives[hi(ctx.draws.d6, positives.length)];
  if (stat === undefined) return;
  const mine = user.stages[stat] ?? 0;
  const theirs = target.stages[stat] ?? 0;
  changeStage(user, stat, theirs - mine, ctx.round, ctx.events);
  changeStage(target, stat, mine - theirs, ctx.round, ctx.events);
}

/**
 * The move a move copy re-uses, with the target that move was aimed at (Ruling 58), or null when there is
 * none: Episodic Replay (`lastAllyMove`) the user's side's last move (SideState.lastMove, which a copy
 * records as the move it copied); Stochastic Repeat (`targetLastMove`) the target's latest resolved move that
 * is not itself a move copy.
 */
export function copySource(ctx: EffectContext, effect: CopyMoveEffect): { def: MoveDef; target: number } | null {
  const user = creature(ctx, ctx.actor);
  if (effect.from === 'lastAllyMove') {
    const last = ctx.state.sides[user.side].lastMove;
    const def = last === null ? null : moveDef(last.moveId);
    return last === null || def === null ? null : { def, target: last.target };
  }
  const history = creature(ctx, ctx.target).moveHistory;
  for (let i = history.length - 1; i >= 0; i--) {
    const record = history[i];
    const def = record === undefined ? null : moveDef(record.moveId);
    if (record !== undefined && def !== null && !copiesMove(def)) return { def, target: record.target };
  }
  return null;
}
