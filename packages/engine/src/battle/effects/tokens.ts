import type { NonPassiveEffect } from '../../content/primitives.js';
import { compact } from '../../context/compaction.js';
import { clearAll, forceTokens, freeOldest } from '../../context/store.js';
import type { BattleEvent } from '../../events/types.js';
import type { BattleState, CreatureState } from '../state.js';
import { recipients, type EffectContext } from './context.js';
import { loseSummarizedBuff } from './stage.js';
import { forceBench } from './swap.js';

export type TokensEffect = Extract<NonPassiveEffect, { kind: 'tokens' }>;

/**
 * `count` forced Junk tokens on `c` (spec §5 Context): an orchestrator's full window compacts its side's
 * lowest-index compactable loadout piece first; a subagent's (no loadout) takes 1 Drift per token instead.
 * Ruling 25: each compacted Subagent Slot piece is removed for the rest of the battle (forceTokens records
 * it in `removedSlots`), so its occupant is force-benched to the end of the bench and the slot never refills.
 */
export function addJunk(state: BattleState, c: CreatureState, count: number, round: number, events: BattleEvent[]): void {
  const grid = c.isOrchestrator ? state.sides[c.side].grid : null;
  const forced = forceTokens(c.context, count, grid, round, c.index);
  events.push(...forced.events);
  for (const slot of state.sides[c.side].slots) {
    if (slot.pieceId === null || slot.occupant === null || !forced.compactedPieceIds.includes(slot.pieceId)) continue;
    const occupant = state.creatures[slot.occupant];
    if (occupant !== undefined) forceBench(state, occupant, round, events);
  }
}

/**
 * `tokens` on every living recipient (spec §5 Context):
 * - `addJunk`: `count` forced Junk tokens (see addJunk).
 * - `freeOldest`: removes the `count` oldest tokens.
 * - `compact`: pairs the six oldest tokens; each summarized buff-tagged token costs its buff 1 stage.
 * - `clear`: removes every token and all Drift (/clear; its stages are a separate `stage clear` effect).
 */
export function applyTokens(ctx: EffectContext, effect: TokensEffect): void {
  const { round, events } = ctx;
  for (const c of recipients(ctx, effect.who)) {
    switch (effect.op) {
      case 'addJunk':
        addJunk(ctx.state, c, effect.count, round, events);
        break;
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
