import type { NonPassiveEffect } from '../../content/primitives.js';
import type { BattleEvent } from '../../events/types.js';
import type { BattleState, CreatureState, SnapshotState } from '../state.js';
import { recipients, type EffectContext } from './context.js';
import { changeStage, STAGE_STATS } from './stage.js';

export type SnapshotEffect = Extract<NonPassiveEffect, { kind: 'snapshot' }>;
export type RevertEffect = Extract<NonPassiveEffect, { kind: 'revert' }>;

/** A new snapshot of `what` on `holder`, by `owner`; replaces that owner's earlier snapshot of the same thing. */
function save(holder: CreatureState, snap: SnapshotState): void {
  holder.snapshots = holder.snapshots.filter((x) => x.owner !== snap.owner || x.what !== snap.what);
  holder.snapshots.push(snap);
}

function take(owner: number, holder: CreatureState, what: 'hp' | 'stages', lastRound: number | null, onKo: boolean): SnapshotState {
  if (what === 'hp') return { owner, what, hp: holder.hp, lastRound, onKo };
  const stages: Record<string, number> = {};
  for (const stat of STAGE_STATS) stages[stat] = holder.stages[stat] ?? 0;
  return { owner, what, stages, lastRound, onKo };
}

/**
 * Restores a snapshot on its holder: HP (Healed when it rises, Damage by the owner when it falls) or every
 * stage (one StageChanged per stat that moves).
 */
function restore(holder: CreatureState, snap: SnapshotState, round: number, events: BattleEvent[]): void {
  if (snap.what === 'stages') {
    for (const stat of STAGE_STATS) changeStage(holder, stat, (snap.stages[stat] ?? 0) - (holder.stages[stat] ?? 0), round, events);
    return;
  }
  const delta = snap.hp - holder.hp;
  holder.hp = snap.hp;
  if (delta > 0) events.push({ round, type: 'Healed', target: holder.index, amount: delta, hpAfter: holder.hp });
  if (delta < 0) events.push({ round, type: 'Damage', actor: snap.owner, target: holder.index, amount: -delta, hpAfter: holder.hp });
}

/**
 * `snapshot` (Save State): saves `what` of every living recipient, to be restored on its first KO up to the
 * end of round + rounds − 1 (the current round counts).
 */
export function applySnapshot(ctx: EffectContext, effect: SnapshotEffect): void {
  for (const c of recipients(ctx, effect.who)) save(c, take(ctx.actor, c, effect.what, ctx.round + effect.rounds - 1, true));
}

/**
 * `revert` (Screenshot): restores the user's held snapshot of `what` on each living recipient and drops it;
 * with none held, takes one instead (it lasts until the user's next revert of that creature).
 */
export function applyRevert(ctx: EffectContext, effect: RevertEffect): void {
  for (const c of recipients(ctx, effect.who)) {
    const held = c.snapshots.find((x) => x.owner === ctx.actor && x.what === effect.what && !x.onKo);
    if (held === undefined) {
      save(c, take(ctx.actor, c, effect.what, null, false));
      continue;
    }
    c.snapshots = c.snapshots.filter((x) => x !== held);
    restore(c, held, ctx.round, ctx.events);
  }
}

/**
 * A KO about to happen (HP is 0): the holder's oldest live revert-on-KO snapshot (Save State) is used up and
 * restored instead — Healed back to the saved HP, no Fainted. Returns whether the KO was reverted.
 */
export function revertKo(c: CreatureState, round: number, events: BattleEvent[]): boolean {
  const snap = c.snapshots.find((x) => x.onKo && (x.lastRound === null || x.lastRound >= round));
  if (snap === undefined) return false;
  c.snapshots = c.snapshots.filter((x) => x !== snap);
  restore(c, snap, round, events);
  return c.hp > 0;
}

/** End of round: snapshots whose last round has passed are dropped (silently: they never fired). */
export function expireSnapshots(state: BattleState): void {
  for (const c of state.creatures) c.snapshots = c.snapshots.filter((x) => x.lastRound === null || x.lastRound > state.round);
}
