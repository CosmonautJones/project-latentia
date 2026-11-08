import { pay } from '../context/store.js';
import type { BattleEvent } from '../events/types.js';
import type { ActionDraws } from '../rng/draws.js';
import { consumeInjection, moveCost } from '../status/apply.js';
import { applyEffect, bookkeeping, effectList, resolveEffects, runTrigger } from './effects/apply.js';
import { chargesFirst, releaseEffects } from './effects/charge.js';
import { creature, effectContext, type EffectContext } from './effects/context.js';
import { copiesMove } from './effects/copy.js';
import { isGuardMove } from './effects/guard.js';
import { takeAccuracyMods, takeCost, takePenaltyBp } from './effects/nextActionModifier.js';
import { buffTag } from './effects/stage.js';
import { heldInjection } from './effects/status.js';
import { breakEnemyChains } from './handoff.js';
import { cardOf } from './levers.js';
import type { ActionEntry } from './order.js';
import { deckAction } from './plan.js';
import type { BattleState, CreatureState, Temperature } from './state.js';
import { aimInjected, aimMove, chooseAction, temperatureOf, type Choice } from './targeting.js';

export type { EffectContext } from './effects/context.js';
export { applyEffect, ROBUST_ACCURACY_BONUS, ROBUST_MIN_GENERALIZATION } from './effects/apply.js';

/**
 * What the entry does, before MoveUsed: a released charge, a hijacked (Prompt Injected) action, or its own move;
 * `cardId` is the deck card that fired for a deck-driven action, else null.
 */
type Plan = { choice: Choice; release: { powerDelta: number } | null; cardId: string | null } | 'charging';

/**
 * The entry's own move and target: a deck-driven entry is re-planned now (re-validation and obedience, plan.ts
 * deckAction) and emits its CardTrace, then BrittleRepeat when the Default move was replaced; any other entry is
 * used as planned.
 */
function ownAction(state: BattleState, user: CreatureState, entry: ActionEntry, draws: ActionDraws, events: BattleEvent[]): ActionEntry {
  if (entry.cardId === undefined) return entry;
  const r = deckAction(state, user, entry, draws.d1);
  events.push({ round: state.round, type: 'CardTrace', actor: user.index, firedCardId: r.trace.firedCardId, skipped: r.trace.skipped });
  if (r.brittleRepeat) events.push({ round: state.round, type: 'BrittleRepeat', actor: user.index, moveId: r.intent.moveId });
  return { ...entry, moveId: r.intent.moveId, target: r.intent.target, cardId: r.trace.firedCardId, replanned: r.intent.replanned };
}

/**
 * A charging user counts one entry down: above 0 it waits ('charging'); at 0 the charged move is released at
 * its stored target (no substitution). Otherwise a held Prompt Injected choice replaces the action, and is
 * consumed (StatusExpired) only if the action goes ahead; else the entry's own move (re-planned from its deck
 * when deck-driven), then hallucination / Drift substitution.
 */
function planAction(state: BattleState, user: CreatureState, entry: ActionEntry, draws: ActionDraws, temperature: Temperature, events: BattleEvent[]): Plan {
  const charge = user.charging;
  if (charge !== null) {
    charge.remaining -= 1;
    if (charge.remaining > 0) return 'charging';
    user.charging = null;
    return { choice: aimMove(state, user, charge.moveId, charge.target), release: { powerDelta: charge.powerDelta }, cardId: null };
  }
  const injected = heldInjection({ state, round: state.round }, user.index);
  if (injected === null) {
    const own = ownAction(state, user, entry, draws, events);
    return { choice: chooseAction(state, user, own, draws, temperature), release: null, cardId: own.cardId ?? null };
  }
  const choice = aimInjected(state, user, injected);
  if (choice !== null) events.push(...consumeInjection(user, state.round).events);
  return { choice, release: null, cardId: null };
}

/**
 * The fired card's Prompt Injected preference (Card.injection), when the move that runs is that card's own move
 * (not one hallucination or Drift substituted); null otherwise. Its selector is resolved against the victim's view
 * when the status lands (effects/status.ts).
 */
function cardInjection(state: BattleState, user: CreatureState, cardId: string | null, moveId: string): EffectContext['cardInjection'] {
  const card = cardId === null ? null : cardOf(state, user, cardId);
  return card?.injection !== undefined && card.move === moveId ? { ...card.injection } : null;
}

/**
 * Resolves one acting entry after its six draws are taken, ActionStarted is emitted and resolveEntry's
 * skip checks (including Rate Limited, Ruling 74) have passed (spec §5 step 4): a charge's countdown /
 * release, a Prompt Injected hijack, or the entry's own move (a deck-driven entry is re-planned: CardTrace,
 * BrittleRepeat) with hallucination / Drift substitution and re-targeting → MoveUsed → pay context (costSet / costAdd, then
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
  ctx.cardInjection = cardInjection(state, user, plan.cardId, move.id);
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
