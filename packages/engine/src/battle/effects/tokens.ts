import type { NonPassiveEffect } from '../../content/primitives.js';
import { compact } from '../../context/compaction.js';
import { clearAll, forceTokens, freeOldest } from '../../context/store.js';
import type { CreatureState } from '../state.js';
import { recipients, type EffectContext } from './context.js';
import { loseSummarizedBuff } from './stage.js';
import { forceBench } from './swap.js';

export type TokensEffect = Extract<NonPassiveEffect, { kind: 'tokens' }>;

/**
 * Ruling 25: each compacted Subagent Slot piece is removed for the rest of the battle (forceTokens records
 * it in `removedSlots`), so its occupant is force-benched to the end of the bench and the slot never refills.
 */
function benchRemovedSlots(ctx: EffectContext, holder: CreatureState, pieceIds: readonly string[]): void {
  const { state } = ctx;
  for (const slot of state.sides[holder.side].slots) {
    if (slot.pieceId === null || slot.occupant === null || !pieceIds.includes(slot.pieceId)) continue;
    const occupant = state.creatures[slot.occupant];
    if (occupant !== undefined) forceBench(state, occupant, ctx.round, ctx.events);
  }
}

/**
 * `tokens` on every living recipient (spec §5 Context):
 * - `addJunk`: `count` forced Junk tokens. A full orchestrator window compacts its lowest-index compactable
 *   loadout piece first (a compacted Subagent Slot force-benches its subagent); a full subagent window
 *   (no loadout) takes 1 Drift per token instead.
 * - `freeOldest`: removes the `count` oldest tokens.
 * - `compact`: pairs the six oldest tokens; each summarized buff-tagged token costs its buff 1 stage.
 * - `clear`: removes every token and all Drift (/clear; its stages are a separate `stage clear` effect).
 */
export function applyTokens(ctx: EffectContext, effect: TokensEffect): void {
  const { round, events } = ctx;
  for (const c of recipients(ctx, effect.who)) {
    switch (effect.op) {
      case 'addJunk': {
        const grid = c.isOrchestrator ? ctx.state.sides[c.side].grid : null;
        const forced = forceTokens(c.context, effect.count, grid, round, c.index);
        events.push(...forced.events);
        benchRemovedSlots(ctx, c, forced.compactedPieceIds);
        break;
      }
      case 'freeOldest':
        events.push(...freeOldest(c.context, effect.count, round, c.index));
        break;
      case 'compact': {
        const done = compact(c.context, round, c.index);
        events.push(...done.events);
        for (const b of done.summarizedBuffs) loseSummarizedBuff(c, b.stat, round, events);
        break;
      }
      case 'clear':
        events.push(...clearAll(c.context, round, c.index));
        break;
    }
  }
}
