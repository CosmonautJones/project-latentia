import type { BattleEvent } from '../events/types.js';
import type { BattleState, SideId } from './state.js';

/** Handoff Chain: each later consecutive allied hit adds +15% (Ruling 97). */
export const HANDOFF_STEP_BP = 1500;
/** The Handoff modifier cap: +30% (the 3rd hit and every later one). */
export const HANDOFF_MAX_BP = 13000;

/**
 * Handoff Chain (bible: "each consecutive allied hit on the same target within a round +10% (cap +30%),
 * and an enemy action in between breaks the chain"; rescaled by Ruling 97, Travis's decision, which amends
 * Ruling 39). The first hit on a target by one side this round takes no Handoff modifier (null); each later
 * consecutive hit takes 10000 + 1500 × min(prior, 2), `prior` being the earlier hits in that side's chain on
 * the target: 2nd hit 11500, 3rd and every later hit 13000. A multi-hit move is one hit.
 */
export function handoffBp(state: BattleState, side: SideId, target: number): number | null {
  const chain = state.handoff.find((h) => h.target === target);
  const prior = chain !== undefined && chain.side === side ? chain.actors.length : 0;
  return prior === 0 ? null : Math.min(10000 + HANDOFF_STEP_BP * prior, HANDOFF_MAX_BP);
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
