import {
  CONDITION_CATEGORIES,
  MOVES,
  SPECIES,
  STATUS_IDS,
  TARGET_SELECTORS,
  TYPES,
  type Card,
  type Condition,
  type ConditionCategory,
  type Deck,
  type FieldKind,
  type SideSetup,
  type SpeciesId,
  type Subject,
} from '@latentia/engine';
import { cardText, conditionText } from './card-text.js';
import type { Sfc32 } from './sfc32.js';

// The deck search's mutations (Ruling 139 a, b): single changes to an Autopilot deck's cards, drawn from the engine's
// card grammar (its condition categories, statuses, types, target selectors) and the orchestrator's known moves.
// Every mutation builds a new deck — the cards it keeps are shared, never edited — and keeps the card count and the
// Default card. A mutation that would change nothing is no candidate; drawCandidate redraws it, and any candidate its
// validity check rejects, up to a cap.

export const MUTATIONS = ['replace', 'condition', 'move', 'reorder'] as const;
export type MutationKind = (typeof MUTATIONS)[number];

/** A candidate deck and what made it: card `index` changed (for a reorder, the card moved from `index` to `to`). */
export type Mutation = { kind: MutationKind; index: number; to: number; deck: Deck; label: string };

/** The grammar's subjects and field kinds; the records make the type checker keep the lists complete. */
const SUBJECT_SET: Record<Subject, true> = { self: true, orchestrator: true, foe: true };
const SUBJECTS = Object.keys(SUBJECT_SET) as Subject[];
const FIELD_KIND_SET: Record<FieldKind, true> = {
  junkPerRound: true,
  revealIntents: true,
  accuracyStages: true,
  forceTemperature: true,
  critStagesAgainst: true,
  revealTopDeckCard: true,
};
const FIELD_KINDS = Object.keys(FIELD_KIND_SET) as FieldKind[];
const OPS = ['below', 'atLeast'] as const;
const PCTS = [25, 50, 75] as const;
const COOLDOWNS = [1, 2, 3] as const;
/** A `turn` condition names a round in 1..TURN_ROUNDS (the opening rounds, where turn conditions matter). */
const TURN_ROUNDS = 10;
const ALL_MOVE_IDS = Object.keys(MOVES);
const UNIVERSAL_MOVE_IDS = Object.values(MOVES)
  .filter((m) => m.universal === true)
  .map((m) => m.id);

/**
 * The moves an Autopilot card may name: the orchestrator's stored moveset — its species' signature and its grid's
 * Skills and grafts (the listed moves of an ungridded one) — then the universal moves, without repeats.
 */
export function movePool(side: SideSetup): string[] {
  const own =
    side.grid === null
      ? side.orchestrator.moves
      : [SPECIES[side.orchestrator.species as SpeciesId].signature, ...side.grid.pieces.flatMap((p) => ((p.kind === 'skill' || p.kind === 'graft') && p.moveId !== undefined ? [p.moveId] : []))];
  return [...new Set([...own, ...UNIVERSAL_MOVE_IDS])];
}

/** A condition drawn from the grammar: a category uniformly, then its parameters uniformly. */
export function randomCondition(rng: Sfc32): Condition {
  const category: ConditionCategory = rng.pick(CONDITION_CATEGORIES);
  switch (category) {
    case 'hp':
    case 'allyHp':
    case 'contextFill':
      return { category, op: rng.pick(OPS), pct: rng.pick(PCTS) };
    case 'status':
      return { category, status: rng.pick(STATUS_IDS) };
    case 'foeType':
      return { category, is: rng.below(TYPES.length + 1) === TYPES.length ? 'weakToMove' : rng.pick(TYPES) };
    case 'foeLastMove':
      return { category, move: rng.pick(ALL_MOVE_IDS) };
    case 'turn':
      return { category, op: rng.pick(OPS), round: 1 + rng.below(TURN_ROUNDS) };
    case 'cooldown':
      return { category, rounds: rng.pick(COOLDOWNS) };
    case 'field':
      return { category, effect: rng.pick(FIELD_KINDS) };
    case 'foeBuffed':
    case 'telegraphing':
    case 'coin':
      return { category };
  }
}

const same = (x: unknown, y: unknown): boolean => JSON.stringify(x) === JSON.stringify(y);

/** `card` naming `move` instead: its Deepfake Call `injection` belonged to the old move, so it is dropped. */
function withMove(card: Card, move: string): Card {
  const next: Card = { ...card, move };
  delete next.injection;
  return next;
}

/**
 * One mutation of `deck`, kind chosen uniformly: replace a card with a fresh one (id `freshId`), redraw a card's
 * subject and condition, give a card another move from `pool`, or move a card to another priority. Null when the
 * draw changes nothing (or cannot: one card, one move).
 */
export function mutate(deck: Deck, pool: readonly string[], rng: Sfc32, freshId: string): Mutation | null {
  const n = deck.cards.length;
  if (n === 0) return null;
  const kind = rng.pick(MUTATIONS);
  const index = rng.below(n);
  const old = deck.cards[index] as Card;
  const cards = [...deck.cards];
  let to = index;
  let label: string;
  if (kind === 'reorder') {
    if (n < 2) return null;
    to = rng.below(n - 1);
    if (to >= index) to++;
    cards.splice(index, 1);
    cards.splice(to, 0, old);
    label = `reorder #${index + 1} → #${to + 1} (${old.id})`;
  } else {
    let card: Card;
    if (kind === 'replace') {
      card = { id: freshId, subject: rng.pick(SUBJECTS), condition: randomCondition(rng), move: rng.pick(pool), target: rng.pick(TARGET_SELECTORS) };
      label = `replace #${index + 1} (${old.id}) with ${freshId}: ${cardText(card)}`;
    } else if (kind === 'condition') {
      card = { ...old, subject: rng.pick(SUBJECTS), condition: randomCondition(rng) };
      label = `condition of #${index + 1} (${old.id}): ${old.subject} ${conditionText(old.condition)} → ${card.subject} ${conditionText(card.condition)}`;
    } else {
      const others = pool.filter((m) => m !== old.move);
      if (others.length === 0) return null;
      card = withMove(old, rng.pick(others));
      label = `move of #${index + 1} (${old.id}): ${old.move} → ${card.move}`;
    }
    if (kind !== 'replace' && same(card, old)) return null;
    cards[index] = card;
  }
  return { kind, index, to, deck: { cards, default: deck.default }, label };
}

/**
 * A mutation of `deck` that `isValid` accepts: draws until one does, at most 1 + `maxRedraws` times. Redraws cost no
 * battles; null when the cap is reached (the search then stops rather than loop on an impossible state).
 */
export function drawCandidate(deck: Deck, pool: readonly string[], rng: Sfc32, freshId: string, isValid: (d: Deck) => boolean, maxRedraws: number): Mutation | null {
  for (let i = 0; i <= maxRedraws; i++) {
    const m = mutate(deck, pool, rng, freshId);
    if (m !== null && isValid(m.deck)) return m;
  }
  return null;
}
