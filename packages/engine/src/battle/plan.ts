import { bandFor, evaluateDeck, type Band, type CardTrace, type EvaluateOptions, type Evaluation } from '../cards/evaluate.js';
import type { Deck } from '../cards/model.js';
import { moveDef } from '../content/moves.js';
import { activeCardCount, VERSION_SLOTS } from '../grid/adjacency.js';
import { EngineInvariantError, mulBp } from '../math/bp.js';
import { effectiveStat } from '../math/stats.js';
import type { RoundStartDraws } from '../rng/draws.js';
import { hasStatus, statStage } from '../status/apply.js';
import { activePolicies, deckOf, policyAddedThisRound } from './levers.js';
import type { RoundCommand } from './log.js';
import { aimsAtUser, defaultIntent, holdsLiveSlot, intentTarget, isHeadless, type ActionEntry, type LeverAction } from './order.js';
import type { BattleState, CreatureState, SideId } from './state.js';
import { viewFor } from './view.js';

// Plan (spec §5 step 2): one action entry per on-field position, with every subagent's intent from its deck
// (or its default intent when it has none) and an uncommanded AI orchestrator's from its side's Autopilot deck;
// deckAction re-plans a deck-driven entry when it resolves
// (re-validation, obedience, Brittle repeat). The intents listings (IntentsPlanned, getIntents) live in intents.ts.

/** Swap and Early Exit resolve at this priority bracket (spec §5 "Orchestrator levers"). */
export const SWAP_PRIORITY = 3;
/** Rate Limited: Speed ×0.5 (bible status table), applied to effective Latency at Sort. */
export const RATE_LIMITED_LATENCY_BP = 5000;

/**
 * A subagent's or Autopilot orchestrator's planned action (spec §4 `getIntents`): its move and target (a self/none
 * move aims at the actor), the deck card that gives it (null without a deck, or while charging), and whether
 * resolution had to re-plan it. Intents are planned assuming the creature obeys; obedience is rolled when a
 * subagent's action resolves (an Autopilot orchestrator always obeys, Ruling 93).
 */
export type Intent = { actor: number; moveId: string; target: number; cardId: string | null; replanned: boolean };

/** Active cards for a subagent (spec §5 grid): its bound slot's adjacent Example Cards, capped by version; versionSlots when gridless. */
export function activeCards(state: BattleState, c: CreatureState): number {
  const grid = state.sides[c.side].grid;
  const pieceId = c.activeSlot === null ? null : (state.sides[c.side].slots[c.activeSlot]?.pieceId ?? null);
  return grid !== null && pieceId !== null ? activeCardCount(grid, pieceId, c.version) : VERSION_SLOTS[c.version];
}

/** The Policy Update cards in force for `c`'s side in `round`, for evaluateDeck (Policy Update, B3). */
function policiesFor(state: BattleState, c: CreatureState, round: number): NonNullable<EvaluateOptions['policies']> {
  return { cards: activePolicies(state, c.side, round), knownMoves: c.moves };
}

/** The creature's generalization band; a creature with no generalization is Stable. */
export function bandOf(c: CreatureState): Band {
  return c.generalization === null ? 'stable' : bandFor(c.generalization);
}

type Planned = Pick<ActionEntry, 'moveId' | 'target' | 'priority' | 'cardId' | 'skipped' | 'injection' | 'lever' | 'autopilot'>;

function moveEntry(actor: number, moveId: string, target: number): Planned {
  const def = moveDef(moveId);
  return { moveId, target: aimsAtUser(def) ? actor : target, priority: def?.priority ?? 0 };
}

/** Directive and Policy Update carry their move's priority (0); Swap resolves at +3; `none` at 0. */
function leverEntry(actor: number, command: LeverAction): Planned {
  const action = structuredClone(command); // the entry never shares objects with the caller's command
  switch (action.kind) {
    case 'directive':
      return { moveId: 'directive', target: action.subagent, priority: moveDef('directive')?.priority ?? 0, lever: action };
    case 'policyUpdate':
      return { moveId: 'policy-update', target: actor, priority: moveDef('policy-update')?.priority ?? 0, lever: action };
    case 'swap':
      return { moveId: 'swap', target: action.in, priority: SWAP_PRIORITY, lever: action };
    case 'none':
      return { moveId: 'none', target: actor, priority: 0, lever: action };
  }
}

/**
 * How a creature's deck (levers.ts deckOf) is evaluated for `round`. A subagent: the Policy Update cards in force,
 * then its top activeCards cards, at its generalization band, rolling obedience when it resolves. An Autopilot
 * orchestrator (Ruling 93): its whole deck (no grid cap, no policies), with no obedience roll (no D1 is passed) and
 * no Brittle repeat (the band is never Brittle) — obedience and Generalization are subagent training. Null with no deck.
 */
type DeckRun = { deck: Deck; activeN: number; opts: EvaluateOptions; rollsObedience: boolean };

function deckRun(state: BattleState, c: CreatureState, round: number): DeckRun | null {
  const deck = deckOf(state, c);
  if (deck === null) return null;
  if (c.isOrchestrator) return { deck, activeN: deck.cards.length, opts: { band: 'robust' }, rollsObedience: false };
  return { deck, activeN: activeCards(state, c), opts: { band: bandOf(c), policies: policiesFor(state, c, round) }, rollsObedience: true };
}

/** The deck's obeying choice against the view for `round` (a selector with no legal target falls back to intentTarget). */
function deckEntry(state: BattleState, c: CreatureState, run: DeckRun, rs: RoundStartDraws | null, round: number): Planned {
  const e = evaluateDeck(run.deck, viewFor(state, c.index, rs, round), run.activeN, run.opts);
  const aim = deckAim(state, c, e);
  return { ...moveEntry(c.index, aim.moveId, aim.target), cardId: e.cardId, skipped: e.trace.skipped };
}

/**
 * A subagent's entry for `round` with round-start draws `rs`: a charging creature releases its charged move at
 * its stored target (Ruling 13); a creature with a deck evaluates the Policy Update cards in force for `round`,
 * its top activeCards cards, then Default against its view (deckEntry); otherwise its default intent.
 */
export function subagentEntry(state: BattleState, c: CreatureState, rs: RoundStartDraws | null, round: number): Planned {
  if (c.charging !== null) return moveEntry(c.index, c.charging.moveId, c.charging.target);
  const run = deckRun(state, c, round);
  if (run === null) {
    const intent = defaultIntent(state, c.index);
    return moveEntry(c.index, intent.moveId, intent.target);
  }
  return deckEntry(state, c, run, rs, round);
}

/**
 * The move and target an evaluation gives: a `fallback` (a status forbids the Default or Brittle repeat move,
 * Rulings 86 and 88) uses the no-deck default intent; a selector with no legal target falls back to intentTarget.
 */
function deckAim(state: BattleState, c: CreatureState, e: Evaluation): { moveId: string; target: number } {
  if (e.fallback) return defaultIntent(state, c.index);
  return { moveId: e.moveId, target: e.target ?? intentTarget(state, c, e.moveId) };
}

/**
 * Whether the side is an Autopilot side this round (Rulings 94, 101): it has an Autopilot config and sent no
 * SideCommand (a present one wins for the round), and its orchestrator is not headless. A charging orchestrator
 * still counts (it releases its charge, but the round plays at the Autopilot temperature).
 */
export function autopilotSide(state: BattleState, side: SideId, cmd: RoundCommand): boolean {
  return !isHeadless(state, side) && cmd[side] === undefined && state.sides[side].autopilot !== null;
}

/** Whether the side's Autopilot deck drives orchestrator `c` this round (Ruling 94): an Autopilot side whose orchestrator is not charging. */
export function autopilotDrives(state: BattleState, c: CreatureState, cmd: RoundCommand): boolean {
  return c.isOrchestrator && c.charging === null && autopilotSide(state, c.side, cmd);
}

/**
 * A charging orchestrator releases its charged move (the command is not used: Ruling 13); an Autopilot-driven one
 * evaluates its side's Autopilot deck (deckEntry, Rulings 93-94); otherwise a non-headless orchestrator follows its
 * side's command, and an uncommanded or headless one its default intent.
 */
export function orchestratorEntry(state: BattleState, c: CreatureState, cmd: RoundCommand, rs: RoundStartDraws | null, round: number): Planned {
  if (c.charging !== null) return moveEntry(c.index, c.charging.moveId, c.charging.target);
  const run = autopilotDrives(state, c, cmd) ? deckRun(state, c, round) : null;
  if (run !== null) return { ...deckEntry(state, c, run, rs, round), autopilot: true };
  const action = isHeadless(state, c.side) ? undefined : cmd[c.side]?.action;
  if (action === undefined) {
    const intent = defaultIntent(state, c.index);
    return moveEntry(c.index, intent.moveId, intent.target);
  }
  if (action.kind !== 'move') return leverEntry(c.index, action);
  const entry = moveEntry(c.index, action.moveId, action.target);
  return action.injection === undefined ? entry : { ...entry, injection: { ...action.injection } };
}

/** The creature's pending `priority` next-action modifiers (Move Fast), summed; read at Sort, used up after it. */
function pendingPriority(c: CreatureState): number {
  return c.nextActionMods.reduce((n, m) => (m.kind === 'priority' ? n + m.delta : n), 0);
}

/** Effective Latency for Sort: the stat with its stage (after Quantized), halved while Rate Limited. */
function sortLatency(c: CreatureState): number {
  const latency = effectiveStat(c.stats.latency, statStage(c, 'latency'));
  return hasStatus(c, 'rateLimited') ? mulBp(latency, RATE_LIMITED_LATENCY_BP) : latency;
}

/** A living subagent in a non-removed active slot: it gets an entry (and an intent). */
export const plansAsSubagent = (state: BattleState, c: CreatureState): boolean => !c.isOrchestrator && !c.fainted && holdsLiveSlot(state, c);

/**
 * Plan (spec §5 step 2, Ruling 31): one entry per on-field position — each side's orchestrator always
 * (even when KO'd: its entry resolves as a headless skip), plus each living subagent in a non-removed
 * active slot. Bench creatures never get entries. An entry's priority includes the creature's pending
 * `priority` next-action modifiers (Move Fast); this reads them without using them up (the round loop does,
 * after Sort). Requires this round's round-start draws (state.round is the round being planned).
 */
export function planEntries(state: BattleState, cmd: RoundCommand): ActionEntry[] {
  const entries: ActionEntry[] = [];
  for (const c of state.creatures) {
    if (!c.isOrchestrator && !plansAsSubagent(state, c)) continue;
    if (c.roundStart === null) {
      throw new EngineInvariantError('planning before round-start draws', { round: state.round, actor: c.index, seed: state.seed });
    }
    const planned = c.isOrchestrator ? orchestratorEntry(state, c, cmd, c.roundStart, state.round) : subagentEntry(state, c, c.roundStart, state.round);
    entries.push({
      actor: c.index,
      latency: sortLatency(c),
      tieBreak: c.roundStart.r1 & 0xffff,
      ...planned,
      priority: planned.priority + pendingPriority(c),
    });
  }
  return entries;
}

/**
 * A deck-driven entry — a subagent's, or an Autopilot orchestrator's (Ruling 93: no obedience roll, never Brittle, no
 * policies) — as it resolves (spec §5 "Re-planning", "Obedience"; Ruling 85): the intent's card is
 * re-validated against the current view — kept with its plan-time target while its condition holds, its move is
 * usable and that target is still legal, else evaluation continues from the next card down — then obedience is
 * rolled with lo(`d1`, 100). The intent is `replanned` (Ruling 92) when the choice it would make by obeying differs
 * from the planned intent in card, move or target; disobedience alone is not a re-plan. The trace is the plan-time cards skipped above the intent's card, then
 * this evaluation's. A selector with no legal target falls back to intentTarget; a disabled Default uses the
 * default intent (deckAim). When a Policy Update of a subagent's side resolved earlier this round (after
 * planning), its deck is instead evaluated afresh from the top, the new policy included: the trace is that
 * evaluation's alone (the same `replanned` rule applies).
 */
export function deckAction(state: BattleState, user: CreatureState, entry: ActionEntry, d1: number): { intent: Intent; trace: CardTrace; brittleRepeat: boolean } {
  const run = deckRun(state, user, state.round);
  if (run === null || entry.cardId === undefined) {
    throw new EngineInvariantError('deckAction on an entry that is not deck-driven', { round: state.round, actor: user.index, seed: state.seed });
  }
  const view = viewFor(state, user.index, user.roundStart, state.round);
  const fresh = !user.isOrchestrator && policyAddedThisRound(state, user.side);
  const opts: EvaluateOptions = { ...run.opts };
  if (run.rollsObedience) opts.d1 = d1;
  if (!fresh) opts.resume = { cardId: entry.cardId, target: entry.target };
  const e = evaluateDeck(run.deck, view, run.activeN, opts);
  const aim = deckAim(state, user, e);
  // Ruling 92, both paths: re-planned when the obeying choice is not the planned intent (card, move or target);
  // a failed obedience roll alone never re-plans.
  const want = e.obeying ?? { cardId: e.cardId, ...aim };
  const replanned = want.cardId !== entry.cardId || want.moveId !== entry.moveId || want.target !== entry.target;
  // The plan-time skips above the intent's card: a disabled Default's own moveDisabled (a plan-time fallback) is
  // traced again by this evaluation, so it is dropped here rather than traced twice.
  const above = (entry.skipped ?? []).filter((k) => k.cardId !== entry.cardId);
  return {
    intent: { actor: user.index, moveId: aim.moveId, target: aim.target, cardId: e.cardId, replanned },
    trace: { firedCardId: e.cardId, skipped: fresh ? e.trace.skipped : [...above, ...e.trace.skipped] },
    brittleRepeat: e.brittleRepeat,
  };
}
