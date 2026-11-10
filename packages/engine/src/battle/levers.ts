import type { Card, Deck } from '../cards/model.js';
import { moveDef } from '../content/moves.js';
import { pay } from '../context/store.js';
import type { BattleEvent } from '../events/types.js';
import { VERSION_SLOTS } from '../grid/adjacency.js';
import { gridActiveCards } from '../grid/derived.js';
import { EngineInvariantError } from '../math/bp.js';
import { moveDisabledByStatus } from '../status/apply.js';
import type { ActionEntry } from './order.js';
import type { BattleState, CreatureState, SideId } from './state.js';

// Directive, Policy Update and Specialist (spec §5 "Orchestrator levers", "Cards, decks and traces"). Levers take
// effect when the orchestrator's ENTRY resolves (Ruling 74), so whatever skips or hijacks that entry (Rate Limited,
// /clear, charging, Prompt Injected, Headless Mode) skips or hijacks the lever too; round.ts dispatches to here.

/** A Policy Update card is in force for this many rounds: r, r+1 and r+2 (spec §5). */
export const POLICY_ROUNDS = 3;

/** The cells a lever costs its orchestrator: its move definition's cost (Directive and Policy Update: 2). */
function leverCells(state: BattleState, id: 'directive' | 'policy-update'): number {
  const def = moveDef(id);
  if (def === null) throw new EngineInvariantError(`no lever definition ${id}`, { round: state.round, seed: state.seed });
  return def.cost;
}

/**
 * Directive (Ruling 74): lands only while `subagent`'s entry this round is still to resolve (it is in turnOrder);
 * then that entry will use `moveId` at `target` instead of its own action (see directedEntry). Otherwise the
 * Directive is spent with no effect and nothing is stored. Returns whether it landed.
 */
export function applyDirective(state: BattleState, side: SideId, subagent: number, moveId: string, target: number, round: number): boolean {
  if (!state.turnOrder.includes(subagent)) return false;
  state.sides[side].directive = { subagent, moveId, target, round };
  return true;
}

/**
 * Policy Update: `card` goes above every allied deck's active cards for rounds `round` … `round` + 2, newest on
 * top. A policy with the same id is replaced (re-issuing a rule refreshes it); it uses no card slot.
 */
export function applyPolicyUpdate(state: BattleState, side: SideId, card: Card, round: number): void {
  const s = state.sides[side];
  s.policies = [{ card: structuredClone(card), fromRound: round, lastRound: round + POLICY_ROUNDS - 1 }, ...s.policies.filter((p) => p.card.id !== card.id)];
}

/**
 * Directive or Policy Update for an orchestrator whose entry acts (no skip, no hijack): MoveUsed announces the lever
 * (`directive` at the directed subagent, `policy-update` at the orchestrator itself; Ruling 90), it pays the lever's
 * cells (overflow becomes Drift, as for any cost), then applies it. A spent Directive emits nothing beyond its
 * MoveUsed and payment, so it is still visible as issued.
 */
export function resolveCommandLever(state: BattleState, orch: CreatureState, lever: Extract<NonNullable<ActionEntry['lever']>, { kind: 'directive' | 'policyUpdate' }>, events: BattleEvent[]): void {
  const round = state.round;
  const id = lever.kind === 'directive' ? 'directive' : 'policy-update';
  events.push({ round, type: 'MoveUsed', actor: orch.index, moveId: id, target: lever.kind === 'directive' ? lever.subagent : orch.index });
  events.push(...pay(orch.context, leverCells(state, id), round, orch.index));
  if (lever.kind === 'directive') applyDirective(state, orch.side, lever.subagent, lever.moveId, lever.target, round);
  else applyPolicyUpdate(state, orch.side, lever.card, round);
}

/**
 * The entry a subagent acts on: a Directive that landed on it this round replaces its own action — the directed
 * move at the directed target, no card (not deck-driven: no CardTrace, no obedience roll) — unless a held status
 * forbids that move by now, when its own action stands. Either way the Directive is used up.
 */
export function directedEntry(state: BattleState, entry: ActionEntry): ActionEntry {
  const c = state.creatures[entry.actor];
  if (c === undefined || c.isOrchestrator) return entry;
  const s = state.sides[c.side];
  const d = s.directive;
  if (d === null || d.subagent !== entry.actor || d.round !== state.round) return entry;
  s.directive = null;
  const def = moveDef(d.moveId);
  if (def === null || moveDisabledByStatus(c, def, c.lastMoveId)) return entry;
  return { actor: entry.actor, priority: entry.priority, latency: entry.latency, tieBreak: entry.tieBreak, moveId: d.moveId, target: d.target };
}

/** The Policy Update cards in force for `side` in `round`, newest first. */
export function activePolicies(state: BattleState, side: SideId, round: number): Card[] {
  return state.sides[side].policies.filter((p) => p.fromRound <= round && round <= p.lastRound).map((p) => p.card);
}

/** Whether a Policy Update resolved this round: subagents planned before it re-evaluate from the top when they act. */
export function policyAddedThisRound(state: BattleState, side: SideId): boolean {
  return state.sides[side].policies.some((p) => p.fromRound === state.round);
}

/** End of round: drop every policy whose last round has passed, and any Directive left unused. */
export function endRoundLevers(state: BattleState): void {
  for (const s of [state.sides.a, state.sides.b]) {
    s.policies = s.policies.filter((p) => p.lastRound > state.round);
    s.directive = null;
  }
}

/**
 * The deck a creature's entries are evaluated from: a subagent's own deck; an orchestrator's side's Autopilot deck
 * (Ruling 93; whether it drives a given round is plan.ts's call). Null when there is none.
 */
export function deckOf(state: BattleState, c: CreatureState): Deck | null {
  return c.isOrchestrator ? (state.sides[c.side].autopilot?.deck ?? null) : c.deck;
}

/**
 * A card of `c`'s deck (deckOf), or for a subagent a policy in force for its side this round, by id; null when there
 * is none. Policies are for subagents: an Autopilot orchestrator never evaluates them (Ruling 93).
 */
export function cardOf(state: BattleState, c: CreatureState, id: string): Card | null {
  const deck = deckOf(state, c);
  if (deck === null) return null;
  const policies = c.isOrchestrator ? [] : activePolicies(state, c.side, state.round);
  return [...policies, ...deck.cards, deck.default].find((k) => k.id === id) ?? null;
}

/** Active cards for a subagent (spec §5 grid): its bound slot's adjacent Example Cards, capped by version; versionSlots when gridless. */
export function activeCards(state: BattleState, c: CreatureState): number {
  const grid = state.sides[c.side].grid;
  const pieceId = c.activeSlot === null ? null : (state.sides[c.side].slots[c.activeSlot]?.pieceId ?? null);
  return grid !== null && pieceId !== null ? gridActiveCards(grid, pieceId, c.version) : VERSION_SLOTS[c.version];
}

/**
 * Specialist (spec §5; Ruling 116): at least half of the deck's ACTIVE non-Default cards — its top `activeN`, the
 * cards planning evaluates — were recorded from `opponentId`; false with no active card. Inactive cards count for
 * nothing, so padding a deck below its active slots unlocks no Specialist.
 */
export function specialistApplies(deck: Deck, opponentId: string, activeN: number): boolean {
  const active = deck.cards.slice(0, Math.min(activeN, deck.cards.length));
  const recorded = active.filter((k) => k.recordedFrom === opponentId).length;
  return active.length > 0 && 2 * recorded >= active.length;
}

/** Specialist for one hit: a subagent with a Specialist deck against a creature of the side it faces (Ruling 81). */
export function specialistAgainst(state: BattleState, user: CreatureState, target: CreatureState): boolean {
  return !user.isOrchestrator && user.deck !== null && target.side !== user.side && specialistApplies(user.deck, state.sides[user.side].opponentId, activeCards(state, user));
}
