import { pay } from '../context/store.js';
import type { BattleEvent } from '../events/types.js';
import { lo, type ActionDraws } from '../rng/draws.js';
import { consumeInjection, hasStatus, moveCost } from '../status/apply.js';
import { applyEffect, bookkeeping, effectList, resolveEffects, runTrigger } from './effects/apply.js';
import { chargesFirst, releaseEffects } from './effects/charge.js';
import { creature, effectContext } from './effects/context.js';
import { copiesMove } from './effects/copy.js';
import { isGuardMove } from './effects/guard.js';
import { takeAccuracyMods, takeCost, takePenaltyBp } from './effects/nextActionModifier.js';
import { buffTag } from './effects/stage.js';
import { heldInjection } from './effects/status.js';
import { breakEnemyChains } from './handoff.js';
import type { ActionEntry } from './order.js';
import type { BattleState, CreatureState, Temperature } from './state.js';
import { aimInjected, aimMove, chooseAction, temperatureOf, type Choice } from './targeting.js';

export type { EffectContext } from './effects/context.js';
export { applyEffect, ROBUST_ACCURACY_BONUS, ROBUST_MIN_GENERALIZATION } from './effects/apply.js';

/** Rate Limited loses the turn when lo(D2, 100) is below this (spec §5 D2 lo). */
export const RATE_LIMITED_SKIP_PCT = 25;

/** What the entry does, before MoveUsed: a released charge, a hijacked (Prompt Injected) action, or its own move. */
type Plan = { choice: Choice; release: { powerDelta: number } | null } | 'charging';

/**
 * A charging user counts one entry down: above 0 it waits ('charging'); at 0 the charged move is released at
 * its stored target (no substitution). Otherwise a held Prompt Injected choice replaces the action, and is
 * consumed (StatusExpired) only if the action goes ahead; else hallucination / Drift / the entry's move.
 */
function planAction(state: BattleState, user: CreatureState, entry: ActionEntry, draws: ActionDraws, temperature: Temperature, events: BattleEvent[]): Plan {
  const charge = user.charging;
  if (charge !== null) {
    charge.remaining -= 1;
    if (charge.remaining > 0) return 'charging';
    user.charging = null;
    return { choice: aimMove(state, user, charge.moveId, charge.target), release: { powerDelta: charge.powerDelta } };
  }
  const injected = heldInjection({ state, round: state.round }, user.index);
  if (injected === null) return { choice: chooseAction(state, user, entry, draws, temperature), release: null };
  const choice = aimInjected(state, user, injected);
  if (choice !== null) events.push(...consumeInjection(user, state.round).events);
  return { choice, release: null };
}

/**
 * Resolves one acting entry after its six draws are taken and ActionStarted is emitted (spec §5 step 4):
 * Rate Limited skip check (lo D2) → a charge's countdown / release, a Prompt Injected hijack, or
 * hallucination / Drift substitution and re-targeting → MoveUsed → pay context (costSet / costAdd, then
 * cost − 1 while Quantized; overflow → Drift; a buff move's tokens carry its buff tag; a release pays
 * nothing) → a charge round stops here (no accuracy, Ruling 13; no Observation, history or lastMoveId,
 * Ruling 55) → the accuracy-step modifiers are taken → fail / failsIf / accuracy (lo D3) → the target's
 * guard → effects in list order (crit lo D4, roll lo D5, hit count hi D5, riders D6) → bookkeeping (of the
 * copied move, after a move copy) → guard streak → history (the move that ran: a copy records the copied
 * move and its target, Ruling 62) and the side's last move → on the creature's
 * first action, its afterFirstAction passives (Ruling 57; before the round loop's win check). An action
 * that gets past the skip checks breaks the enemy's Handoff chains. Uses only the six given draws.
 */
export function resolveAction(state: BattleState, entry: ActionEntry, draws: ActionDraws, events: BattleEvent[]): void {
  const round = state.round;
  const user = creature({ state, round }, entry.actor);
  if (hasStatus(user, 'rateLimited') && lo(draws.d2, 100) < RATE_LIMITED_SKIP_PCT) {
    events.push({ round, type: 'ActionSkipped', actor: user.index, reason: 'rateLimited' });
    return;
  }
  const temperature = temperatureOf(state, user);
  const plan = planAction(state, user, entry, draws, temperature, events);
  if (plan === 'charging' || plan.choice === null) {
    events.push({ round, type: 'ActionSkipped', actor: user.index, reason: plan === 'charging' ? 'charging' : 'fainted' });
    return;
  }
  const { move, target: targetIndex } = plan.choice;
  breakEnemyChains(state, user.side);
  events.push({ round, type: 'MoveUsed', actor: user.index, moveId: move.id, target: targetIndex });
  const listed = effectList(move, temperature);
  const chargeRound = plan.release === null && chargesFirst(listed);
  if (plan.release === null) events.push(...pay(user.context, moveCost(user, takeCost(user, move.cost)), round, user.index, buffTag(listed)));
  // A charge round does not spend Refusal's penalty: the release is the move that deals the damage.
  const ctx = effectContext(state, user.index, targetIndex, move, draws, temperature, events, chargeRound ? null : takePenaltyBp(user));
  ctx.injection = entry.injection ?? null;
  if (plan.release !== null) ctx.powerAdd = plan.release.powerDelta;
  const target = creature(ctx, targetIndex);
  const first = !user.actedThisBattle;
  user.actedThisBattle = true;
  if (chargeRound) {
    // Ruling 55: a charge round is not a sighting and not a resolved move — no Observation, no history.
    for (const e of listed) if (e.kind === 'charge') applyEffect(ctx, e);
    user.guardStreak = 0;
  } else {
    ctx.accMods = takeAccuracyMods(user);
    resolveEffects(ctx, plan.release === null ? listed : releaseEffects(listed), user, target);
    const done = ctx.copied ?? ctx;
    bookkeeping(done, user, creature(done, done.target));
    user.guardStreak = isGuardMove(listed) ? user.guardStreak + 1 : 0;
    user.lastMoveId = move.id;
    user.moveHistory.push({ round, moveId: done.move.id, target: done.target, damaged: [...ctx.tally.damaged] });
    if (!copiesMove(done.move)) state.sides[user.side].lastMove = { actor: user.index, moveId: done.move.id, target: done.target };
  }
  if (first) runTrigger(state, user, 'afterFirstAction', events, ctx);
}
