import type { NextActionMod, NonPassiveEffect } from '../../content/primitives.js';
import { mulBp } from '../../math/bp.js';
import type { CreatureState } from '../state.js';
import { recipients, type AccuracyMods, type EffectContext } from './context.js';

export type NextActionModifierEffect = Extract<NonPassiveEffect, { kind: 'nextActionModifier' }>;

/**
 * `nextActionModifier`: queues the modifier on every living recipient's `nextActionMods`. Each kind is used
 * up at one point of the holder's next action:
 * - `priority` (Move Fast): added to its entry's priority at its next Sort (takeSortPriority).
 * - `costSet` / `costAdd` (Embedding Cache, Token Nibble): when its next move pays (takeCost).
 * - `fail` / `cannotMiss` / `ignoreEvasion` / `accuracy` (Segfault, Bounding Box, Ground Truth, Socratic
 *   Method): at its next move's accuracy step (takeAccuracyMods; a charge round has none, Ruling 13).
 * - `powerBp` (Refusal's penalty): by its next move that is not a charge round (takePenaltyBp).
 * - `incomingDamageBp` (Earnest Apology): by the next hit it takes (damage.ts takeIncomingBp).
 * - `skip` (/clear): by its next orchestrator entry (the round loop); a no-op on a subagent (Ruling 11).
 */
export function applyNextActionModifier(ctx: EffectContext, effect: NextActionModifierEffect): void {
  const mod = effect.modifier;
  for (const c of recipients(ctx, effect.who)) {
    if (mod.kind === 'skip' && !c.isOrchestrator) continue;
    c.nextActionMods.push({ ...mod });
  }
}

/** Removes the holder's pending modifiers that `take` selects and returns them, oldest first. */
function take<K extends NextActionMod['kind']>(c: CreatureState, kinds: readonly K[]): Extract<NextActionMod, { kind: K }>[] {
  const taken: Extract<NextActionMod, { kind: K }>[] = [];
  const kept: NextActionMod[] = [];
  for (const m of c.nextActionMods) {
    if ((kinds as readonly string[]).includes(m.kind)) taken.push(m as Extract<NextActionMod, { kind: K }>);
    else kept.push(m);
  }
  c.nextActionMods = kept;
  return taken;
}

/** Uses up the pending `priority` modifiers (Sort has read them: order.ts planEntries). */
export function takeSortPriority(c: CreatureState): void {
  take(c, ['priority']);
}

/**
 * The cells the holder's move pays before Quantized: `costSet` replaces the move's cost (the last one wins),
 * then each `costAdd` adds. Uses both kinds up.
 */
export function takeCost(c: CreatureState, cost: number): number {
  let cells = cost;
  const mods = take(c, ['costSet', 'costAdd']);
  for (const m of mods) if (m.kind === 'costSet') cells = m.cells;
  for (const m of mods) if (m.kind === 'costAdd') cells += m.cells;
  return cells;
}

/** Uses up the holder's `fail`, `cannotMiss`, `ignoreEvasion` and `accuracy` modifiers and combines them. */
export function takeAccuracyMods(c: CreatureState): AccuracyMods {
  const mods = take(c, ['fail', 'cannotMiss', 'ignoreEvasion', 'accuracy']);
  return {
    fail: mods.some((m) => m.kind === 'fail'),
    cannotMiss: mods.some((m) => m.kind === 'cannotMiss'),
    ignoreEvasion: mods.some((m) => m.kind === 'ignoreEvasion'),
    accuracy: mods.reduce((n, m) => (m.kind === 'accuracy' ? n + m.delta : n), 0),
  };
}

/** Uses up the holder's pending `powerBp` modifiers (Refusal's penalty) and returns their product, or null. */
export function takePenaltyBp(c: CreatureState): number | null {
  let bp: number | null = null;
  for (const m of take(c, ['powerBp'])) bp = bp === null ? m.bp : mulBp(bp, m.bp);
  return bp;
}
