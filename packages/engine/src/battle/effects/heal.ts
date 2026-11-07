import type { NonPassiveEffect } from '../../content/primitives.js';
import { assertSafe, idiv, mulBp } from '../../math/bp.js';
import { creature, recipients, type EffectContext } from './context.js';
import { pieceBonus } from './damage.js';

export type HealEffect = Extract<NonPassiveEffect, { kind: 'heal' }>;

/** One Tool effect step on a heal's percentage (spec §5 Grid model: +1000 bp, i.e. ×1.1). */
const TOOL_STEP_BP = 11000;
const SUMMARY_BP = 5000;

/**
 * The heal's magnitude in basis points of max HP: pct × 100, then ×11000 per Tool step and ×5000 for a
 * compacted Skill — the same piece bonuses damage takes on its power, applied to the percentage instead
 * (only an orchestrator's move from a grid piece has them).
 */
function healBp(ctx: EffectContext, pct: number): number {
  const { toolSteps, summary } = pieceBonus(ctx.state, creature(ctx, ctx.actor), ctx.move.id);
  let bp = assertSafe(pct * 100, 'heal bp');
  for (let i = 0; i < toolSteps; i++) bp = mulBp(bp, TOOL_STEP_BP);
  if (summary) bp = mulBp(bp, SUMMARY_BP);
  return bp;
}

/**
 * `heal`: each living recipient regains floor(maxHp × magnitude / 10000) HP, capped at its max HP.
 * Healed carries the HP actually restored (0 at full HP) and the new HP.
 */
export function applyHeal(ctx: EffectContext, effect: HealEffect): void {
  const bp = healBp(ctx, effect.pct);
  for (const c of recipients(ctx, effect.who)) {
    const amount = Math.min(idiv(assertSafe(c.maxHp * bp, 'heal amount'), 10000), c.maxHp - c.hp);
    c.hp += amount;
    ctx.events.push({ round: ctx.round, type: 'Healed', target: c.index, amount, hpAfter: c.hp });
  }
}
