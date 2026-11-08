import { CONDITION_CATEGORIES, FIELD_KINDS, SUBJECTS, TARGET_SELECTORS, type Card, type ConditionCategory, type Deck } from '../cards/model.js';
import { STATUS_IDS, TYPES } from '../content/ids.js';
import { MOVES } from '../content/moves.js';
import type { ValidationError } from './setup.js';
import { field, isRecord, isStr, shape } from './shape.js';

// Deck validation (Review Focus 3, Rulings 75 and 82). deckShapeErrors is the type-level check setup-shape.ts
// runs on untrusted JSON (code `shape`; a missing Default is not a shape error). deckErrors is the value check
// validateSetup runs on a well-shaped deck: `deckDefault`, `duplicateId`, `unknownId`, `moveNotKnown`,
// `cardSubject` and `range`.

type Errors = ValidationError[];

const oneOf =
  (values: readonly unknown[]) =>
  (v: unknown): boolean =>
    values.includes(v);

const OPS = ['below', 'atLeast'] as const;
const PCTS = [25, 50, 75] as const;
/** Categories that read the actor, not the subject: their cards must say subject 'self' (Ruling 82). */
export const ACTOR_CATEGORIES: readonly ConditionCategory[] = ['turn', 'cooldown', 'allyHp', 'coin'];

/** The fields each condition category needs (spec §5 card grammar). */
function conditionShape(c: unknown, path: string, errors: Errors): void {
  if (!isRecord(c)) {
    shape(errors, path, 'a condition must be an object');
    return;
  }
  if (!CONDITION_CATEGORIES.includes(c.category as ConditionCategory)) {
    shape(errors, `${path}.category`, `category must be one of ${CONDITION_CATEGORIES.join(', ')}`);
    return;
  }
  const threshold = (): void => {
    field(c, 'op', path, oneOf(OPS), 'below or atLeast', errors);
    field(c, 'pct', path, oneOf(PCTS), '25, 50 or 75', errors);
  };
  switch (c.category as ConditionCategory) {
    case 'hp':
    case 'allyHp':
    case 'contextFill':
      threshold();
      return;
    case 'status':
      field(c, 'status', path, oneOf(STATUS_IDS), 'a status id', errors);
      return;
    case 'foeType':
      field(c, 'is', path, oneOf([...TYPES, 'weakToMove']), 'a type id or weakToMove', errors);
      return;
    case 'foeLastMove':
      field(c, 'move', path, isStr, 'a move id', errors);
      return;
    case 'turn':
      field(c, 'op', path, oneOf(OPS), 'below or atLeast', errors);
      field(c, 'round', path, (v) => typeof v === 'number', 'a number', errors);
      return;
    case 'cooldown':
      field(c, 'rounds', path, oneOf([1, 2, 3]), '1, 2 or 3', errors);
      return;
    case 'field':
      field(c, 'effect', path, oneOf(FIELD_KINDS), 'a field effect kind', errors);
      return;
    case 'foeBuffed':
    case 'telegraphing':
    case 'coin':
      return;
  }
}

function cardShape(card: unknown, path: string, errors: Errors): void {
  if (!isRecord(card)) {
    shape(errors, path, 'a card must be an object');
    return;
  }
  field(card, 'id', path, isStr, 'a string', errors);
  field(card, 'subject', path, oneOf(SUBJECTS), 'self, orchestrator or foe', errors);
  conditionShape(card.condition, `${path}.condition`, errors);
  field(card, 'move', path, isStr, 'a move id', errors);
  field(card, 'target', path, oneOf(TARGET_SELECTORS), 'a target selector', errors);
  field(card, 'allowOverflow', path, (v) => v === undefined || v === true, 'true when present', errors);
  field(card, 'recordedFrom', path, (v) => v === undefined || isStr(v), 'a string when present', errors);
  const inj = card.injection;
  if (inj === undefined) return;
  if (!isRecord(inj)) shape(errors, `${path}.injection`, 'injection must be an object when present');
  else {
    field(inj, 'moveId', `${path}.injection`, isStr, 'a move id', errors);
    field(inj, 'target', `${path}.injection`, oneOf(TARGET_SELECTORS), 'a target selector', errors);
  }
}

/** Type-level problems with an untrusted deck at `path` (never prints the offending value, never throws). */
export function deckShapeErrors(deck: unknown, path: string, errors: Errors): void {
  if (!isRecord(deck)) {
    shape(errors, path, 'a deck must be an object');
    return;
  }
  if (!Array.isArray(deck.cards)) shape(errors, `${path}.cards`, 'cards must be an array');
  else for (let i = 0; i < deck.cards.length; i++) cardShape(deck.cards[i], `${path}.cards[${i}]`, errors);
  // A missing Default is a value error (deckDefault), not a shape error.
  if (deck.default !== undefined && deck.default !== null) cardShape(deck.default, `${path}.default`, errors);
}

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

/** Whether an untrusted value is a well-shaped card (a Policy Update command's card; invalidCommand otherwise). */
export function cardShapeOk(card: unknown): boolean {
  const errors: Errors = [];
  cardShape(card, 'card', errors);
  return errors.length === 0;
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

/**
 * Value problems with a well-shaped deck at `path`, for a creature whose stored moveset is `known` (its listed or
 * grid moves; universal moves are always known): deckDefault when there is no Default card, duplicateId for a
 * repeated card id (Default included: traces and re-planning name cards by id), then each card's errors.
 */
export function deckErrors(deck: Deck, path: string, known: readonly string[], errors: Errors): void {
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
