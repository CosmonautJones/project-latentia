import type { Card, ConditionCategory, Deck } from '../cards/model.js';
import { MOVES } from '../content/moves.js';
import type { ValidationError } from './setup.js';

// Deck validation (Review Focus 3, Rulings 75 and 82). The type-level check of untrusted JSON (code `shape`) is
// cards/deck-shape.ts deckShapeErrors, which setup-shape.ts runs. deckErrors is the value check
// validateSetup runs on a well-shaped deck: `deckDefault`, `duplicateId`, `unknownId`, `moveNotKnown`,
// `cardSubject` and `range`; a subagent deck is held to MAX_DECK_CARDS and an Autopilot deck to MAX_AUTOPILOT_CARDS
// (`deckSize`, Rulings 95 and 117).

type Errors = ValidationError[];

/** An Autopilot deck holds at most this many cards, its Default card aside (spec §5 "Cards, decks and traces"). */
export const MAX_AUTOPILOT_CARDS = 12;
/** A subagent deck holds at most this many cards, its Default card aside (Ruling 117: the Autopilot rule). */
export const MAX_DECK_CARDS = 12;

/** Categories that read the actor, not the subject: their cards must say subject 'self' (Ruling 82). */
export const ACTOR_CATEGORIES: readonly ConditionCategory[] = ['turn', 'cooldown', 'allyHp', 'coin'];

const knownMoveId = (id: string): boolean => Object.prototype.hasOwnProperty.call(MOVES, id);

/** unknownId for a move id that is not in the content. */
function moveExists(id: string, path: string, errors: Errors): boolean {
  if (knownMoveId(id)) return true;
  errors.push({ code: 'unknownId', path, message: `unknown move ${id}` });
  return false;
}

/** One card's values: its move (unknownId, else moveNotKnown), cardSubject, the turn round and the move ids it names. */
function cardErrors(card: Card, path: string, knows: (moveId: string) => boolean, errors: Errors): void {
  if (moveExists(card.move, `${path}.move`, errors) && !knows(card.move)) {
    errors.push({ code: 'moveNotKnown', path: `${path}.move`, message: `the creature does not know ${card.move}` });
  }
  const cond = card.condition;
  if (ACTOR_CATEGORIES.includes(cond.category) && card.subject !== 'self') {
    errors.push({ code: 'cardSubject', path: `${path}.subject`, message: `a ${cond.category} condition reads the actor: its subject must be self` });
  }
  if (cond.category === 'turn' && !(Number.isSafeInteger(cond.round) && cond.round >= 1)) {
    errors.push({ code: 'range', path: `${path}.condition.round`, message: 'round must be a positive integer' });
  }
  if (cond.category === 'foeLastMove') moveExists(cond.move, `${path}.condition.move`, errors);
  if (card.injection !== undefined) moveExists(card.injection.moveId, `${path}.injection.moveId`, errors);
}

/**
 * Value problems with a well-shaped Policy Update card: the rules every deck card meets (unknownId for the moves it
 * names, cardSubject, range) except moveNotKnown — a policy is team-wide, and a subagent that does not know its
 * move traces it `moveDisabled` instead (cards/evaluate.ts).
 */
export function policyCardErrors(card: Card): ValidationError[] {
  const errors: Errors = [];
  cardErrors(card, 'card', () => true, errors);
  return errors;
}

/** deckSize when the deck holds more than `max` cards besides its Default, at its cards path. */
function deckSizeErrors(deck: Deck, path: string, max: number, what: string, errors: Errors): void {
  if (deck.cards.length > max) {
    errors.push({ code: 'deckSize', path: `${path}.cards`, message: `${what} holds at most ${max} cards besides its Default, got ${deck.cards.length}` });
  }
}

/**
 * Value problems with a well-shaped deck at `path`, for a creature whose stored moveset is `known` (its listed or
 * grid moves; universal moves are always known): deckDefault when there is no Default card, duplicateId for a
 * repeated card id (Default included: traces and re-planning name cards by id), then each card's errors.
 */
function deckValueErrors(deck: Deck, path: string, known: readonly string[], errors: Errors): void {
  const knows = (m: string): boolean => known.includes(m) || MOVES[m as keyof typeof MOVES].universal === true;
  const defaultCard = deck.default as Card | null | undefined;
  const all: [Card, string][] = deck.cards.map((c, i) => [c, `${path}.cards[${i}]`]);
  if (defaultCard === undefined || defaultCard === null) errors.push({ code: 'deckDefault', path: `${path}.default`, message: 'a deck needs a Default card' });
  else all.push([defaultCard, `${path}.default`]);
  const ids = new Set<string>();
  for (const [card, at] of all) {
    if (ids.has(card.id)) errors.push({ code: 'duplicateId', path: `${at}.id`, message: `duplicate card id ${card.id}` });
    ids.add(card.id);
    cardErrors(card, at, knows, errors);
  }
}

/**
 * Value problems with a well-shaped subagent deck at `path`, for a subagent whose listed moves are `known`
 * (Ruling 117): deckSize above MAX_DECK_CARDS cards (the Default card aside), then deckDefault, duplicateId and
 * each card's errors.
 */
export function deckErrors(deck: Deck, path: string, known: readonly string[], errors: Errors): void {
  deckSizeErrors(deck, path, MAX_DECK_CARDS, 'a subagent deck', errors);
  deckValueErrors(deck, path, known, errors);
}

/**
 * Value problems with a well-shaped Autopilot deck at `path` for an orchestrator whose stored moveset is `known`
 * (Ruling 95): deckSize above MAX_AUTOPILOT_CARDS cards (the Default card aside), then the same rules as deckErrors.
 */
export function autopilotDeckErrors(deck: Deck, path: string, known: readonly string[], errors: Errors): void {
  deckSizeErrors(deck, path, MAX_AUTOPILOT_CARDS, 'an Autopilot deck', errors);
  deckValueErrors(deck, path, known, errors);
}
