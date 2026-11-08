import type { BattleEvent } from '../events/types.js';
import type { BattleState, SideId } from './state.js';

/** The Handoff modifier grows by 1000 per earlier chained hit, up to this many (11000 / 12000 / 13000). */
export const HANDOFF_CAP_HITS = 3;

/**
 * Handoff Chain (bible: "each consecutive allied hit on the same target within a round +10% (cap +30%),
 * and an enemy action in between breaks the chain"; Ruling 39). The first hit on a target by one side
 * this round takes no Handoff modifier (null); the k-th consecutive hit (k ≥ 2) takes
 * 10000 + 1000 × min(k − 1, 3): 11000, 12000, then 13000. A multi-hit move is one hit.
 */
export function handoffBp(state: BattleState, side: SideId, target: number): number | null {
  const chain = state.handoff.find((h) => h.target === target);
  const prior = chain !== undefined && chain.side === side ? chain.actors.length : 0;
  return prior === 0 ? null : 10000 + 1000 * Math.min(prior, HANDOFF_CAP_HITS);
}

/** An action by a creature of `side` breaks every chain built by the other side (an enemy action in between). */
export function breakEnemyChains(state: BattleState, side: SideId): void {
  state.handoff = state.handoff.filter((h) => h.side === side);
}

/** Records `actor`'s hit on `target` (replacing another side's chain on it) and emits HandoffChain. */
export function extendChain(state: BattleState, actor: number, side: SideId, target: number, round: number, events: BattleEvent[]): void {
  let chain = state.handoff.find((h) => h.target === target);
  if (chain === undefined || chain.side !== side) {
    state.handoff = state.handoff.filter((h) => h.target !== target);
    chain = { target, side, actors: [] };
    state.handoff.push(chain);
  }
  chain.actors.push(actor);
  events.push({ round, type: 'HandoffChain', actor, chain: [...chain.actors] });
}
