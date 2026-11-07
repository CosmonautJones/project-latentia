import type { NonPassiveEffect } from '../../content/primitives.js';
import { EngineInvariantError } from '../../math/bp.js';
import { recipients, type EffectContext } from './context.js';

export type NextActionModifierEffect = Extract<NonPassiveEffect, { kind: 'nextActionModifier' }>;

/**
 * `nextActionModifier`: queues the modifier on every living recipient's `nextActionMods`. Only the kinds
 * something already consumes are accepted here: `powerBp` (Refusal's penalty, taken by the holder's next
 * action), `incomingDamageBp` (Earnest Apology, taken by the next hit on the holder) and `skip` (/clear,
 * taken by the round loop at the holder's next orchestrator entry; a no-op on a subagent, Ruling 11).
 * The other kinds arrive with their consumers in A13 and throw until then.
 */
export function applyNextActionModifier(ctx: EffectContext, effect: NextActionModifierEffect): void {
  const mod = effect.modifier;
  if (mod.kind !== 'powerBp' && mod.kind !== 'incomingDamageBp' && mod.kind !== 'skip') {
    throw new EngineInvariantError(`unimplemented next-action modifier ${mod.kind}`, { round: ctx.round, actor: ctx.actor, seed: ctx.state.seed });
  }
  for (const c of recipients(ctx, effect.who)) {
    if (mod.kind === 'skip' && !c.isOrchestrator) continue;
    c.nextActionMods.push({ ...mod });
  }
}
