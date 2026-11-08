import { bandFor, evaluateDeck, type Band, type CardTrace, type EvaluateOptions, type Evaluation } from '../cards/evaluate.js';
import type { Deck } from '../cards/model.js';
import { moveDef } from '../content/moves.js';
import type { BattleEvent } from '../events/types.js';
import { activeCardCount, VERSION_SLOTS } from '../grid/adjacency.js';
import { EngineInvariantError, mulBp } from '../math/bp.js';
import { effectiveStat } from '../math/stats.js';
import { drawRoundStart, type RoundStartDraws } from '../rng/draws.js';
import { hasStatus, statStage } from '../status/apply.js';
import { activePolicies, policyAddedThisRound } from './levers.js';
import type { RoundCommand } from './log.js';
import { aimsAtUser, defaultIntent, holdsLiveSlot, intentTarget, isHeadless, type ActionEntry, type LeverAction } from './order.js';
import type { BattleState, CreatureState } from './state.js';
import { viewFor } from './view.js';

// Plan (spec §5 step 2): one action entry per on-field position, with every subagent's intent from its deck
// (or its default intent when it has none); getIntents previews the next round's intents; deckAction re-plans
// a deck-driven entry when it resolves (re-validation, obedience, Brittle repeat).

/** Swap and Early Exit resolve at this priority bracket (spec §5 "Orchestrator levers"). */
export const SWAP_PRIORITY = 3;
/** Rate Limited: Speed ×0.5 (bible status table), applied to effective Latency at Sort. */
export const RATE_LIMITED_LATENCY_BP = 5000;

/**
 * A subagent's planned action (spec §4 `getIntents`): its move and target (a self/none move aims at the
 * actor), the deck card that gives it (null without a deck, or while charging), and whether resolution had to
 * re-plan it. Intents are planned assuming the creature obeys; obedience is rolled when the action resolves.
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

type Planned = Pick<ActionEntry, 'moveId' | 'target' | 'priority' | 'cardId' | 'skipped' | 'injection' | 'lever'>;

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
 * A subagent's entry for `round` with round-start draws `rs`: a charging creature releases its charged move at
 * its stored target (Ruling 13); a creature with a deck evaluates the Policy Update cards in force for `round`,
 * its top activeCards cards, then Default against its view (the obeying choice; a selector with no legal target
 * falls back to intentTarget); otherwise its default intent.
 */
function subagentEntry(state: BattleState, c: CreatureState, rs: RoundStartDraws | null, round: number): Planned {
  if (c.charging !== null) return moveEntry(c.index, c.charging.moveId, c.charging.target);
  if (c.deck === null) {
    const intent = defaultIntent(state, c.index);
    return moveEntry(c.index, intent.moveId, intent.target);
  }
  const e = evaluateDeck(c.deck, viewFor(state, c.index, rs, round), activeCards(state, c), { band: bandOf(c), policies: policiesFor(state, c, round) });
  const aim = deckAim(state, c, e);
  return { ...moveEntry(c.index, aim.moveId, aim.target), cardId: e.cardId, skipped: e.trace.skipped };
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
 * A charging orchestrator releases its charged move (the command is not used: Ruling 13); otherwise a
 * non-headless orchestrator follows its side's command, and an uncommanded or headless one its default intent.
 */
function orchestratorEntry(state: BattleState, c: CreatureState, cmd: RoundCommand): Planned {
  if (c.charging !== null) return moveEntry(c.index, c.charging.moveId, c.charging.target);
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
const plansAsSubagent = (state: BattleState, c: CreatureState): boolean => !c.isOrchestrator && !c.fainted && holdsLiveSlot(state, c);

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
    const planned = c.isOrchestrator ? orchestratorEntry(state, c, cmd) : subagentEntry(state, c, c.roundStart, state.round);
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

function intentOf(actor: number, p: Pick<ActionEntry, 'moveId' | 'target' | 'cardId'>): Intent {
  return { actor, moveId: p.moveId, target: p.target, cardId: p.cardId ?? null, replanned: false };
}

/**
 * IntentsPlanned (spec §5 step 2): the subagent entries' intents, in canonical order. Orchestrators act on
 * commands and are not listed (B4 adds Autopilot intents).
 */
export function intentsPlanned(state: BattleState, entries: readonly ActionEntry[]): BattleEvent {
  const intents = entries.filter((e) => state.creatures[e.actor]?.isOrchestrator === false).map((e) => {
    const { actor, moveId, target, cardId } = intentOf(e.actor, e);
    return { actor, moveId, target, cardId };
  });
  return { round: state.round, type: 'IntentsPlanned', intents };
}

/**
 * The next round's subagent intents, before submitRound (Rulings 79, 82): the round-start draws are taken for
 * every creature in canonical order from a CLONE of the rng and each view is built for round `state.round + 1`,
 * so the intents equal what submitRound plans when nothing changes. The state is not modified. Empty once the
 * battle has ended.
 */
export function getIntents(state: BattleState): Intent[] {
  if (state.ended) return [];
  const rng = structuredClone(state.rng);
  const draws = state.creatures.map(() => drawRoundStart(rng));
  return state.creatures.filter((c) => plansAsSubagent(state, c)).map((c) => intentOf(c.index, subagentEntry(state, c, draws[c.index] ?? null, state.round + 1)));
}

/**
 * A deck-driven entry as it resolves (spec §5 "Re-planning", "Obedience"; Ruling 85): the intent's card is
 * re-validated against the current view — kept with its plan-time target while its condition holds, its move is
 * usable and that target is still legal, else evaluation continues from the next card down (`replanned`) — then
 * obedience is rolled with lo(`d1`, 100). The trace is the plan-time cards skipped above the intent's card, then
 * this evaluation's. A selector with no legal target falls back to intentTarget; a disabled Default uses the
 * default intent (deckAim). When a Policy Update of the creature's side resolved earlier this round (after
 * planning), the deck is instead evaluated afresh from the top, the new policy included: the trace is that
 * evaluation's alone, and the intent is `replanned` when its card, move or target changed.
 */
export function deckAction(state: BattleState, user: CreatureState, entry: ActionEntry, d1: number): { intent: Intent; trace: CardTrace; brittleRepeat: boolean } {
  const deck: Deck | null = user.deck;
  if (deck === null || entry.cardId === undefined) {
    throw new EngineInvariantError('deckAction on an entry that is not deck-driven', { round: state.round, actor: user.index, seed: state.seed });
  }
  const view = viewFor(state, user.index, user.roundStart, state.round);
  const fresh = policyAddedThisRound(state, user.side);
  const opts: EvaluateOptions = { band: bandOf(user), d1, policies: policiesFor(state, user, state.round) };
  if (!fresh) opts.resume = { cardId: entry.cardId, target: entry.target };
  const e = evaluateDeck(deck, view, activeCards(state, user), opts);
  const aim = deckAim(state, user, e);
  const changed = e.cardId !== entry.cardId || aim.moveId !== entry.moveId || aim.target !== entry.target;
  // A fallback is re-derived now: the intent is re-planned when it no longer matches the plan.
  const replanned = fresh ? changed : e.replanned || (e.fallback && (aim.moveId !== entry.moveId || aim.target !== entry.target));
  return {
    intent: { actor: user.index, moveId: aim.moveId, target: aim.target, cardId: e.cardId, replanned },
    trace: { firedCardId: e.cardId, skipped: fresh ? e.trace.skipped : [...(entry.skipped ?? []), ...e.trace.skipped] },
    brittleRepeat: e.brittleRepeat,
  };
}
