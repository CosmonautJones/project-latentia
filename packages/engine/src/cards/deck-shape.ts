import { CONDITION_CATEGORIES, FIELD_KINDS, SUBJECTS, TARGET_SELECTORS, type ConditionCategory } from './model.js';
import { STATUS_IDS, TYPES } from '../content/ids.js';
import { field, isRecord, isStr, shape, type ShapeError } from './json.js';

// Deck shape (Ruling 75): the type-level check of an untrusted deck or card (code `shape`; a missing Default is not a
// shape error). battle/setup-shape.ts runs it on setups, battle/errors.ts on Policy Update cards, and
// generalization/score.ts on the deck it scores (Ruling 107). Value checks stay in battle/validate-deck.ts.

type Errors = ShapeError[];

const oneOf =
  (values: readonly unknown[]) =>
  (v: unknown): boolean =>
    values.includes(v);

const OPS = ['below', 'atLeast'] as const;
const PCTS = [25, 50, 75] as const;

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

/** Whether an untrusted value is a well-shaped card (a Policy Update command's card; invalidCommand otherwise). */
export function cardShapeOk(card: unknown): boolean {
  const errors: Errors = [];
  cardShape(card, 'card', errors);
  return errors.length === 0;
}
