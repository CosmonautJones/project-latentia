import fc from 'fast-check';
import { UNIVERSAL_MOVES } from '../../src/battle/setup.js';
import { FIELD_KINDS, SUBJECTS, TARGET_SELECTORS, type Card, type Condition, type Deck, type Subject } from '../../src/cards/model.js';
import { STATUS_IDS, TYPES } from '../../src/content/ids.js';
import { SPECIES } from '../../src/content/species.js';

// A legal deck arbitrary for the property and fuzz suites (B2): validateSetup accepts every deck it builds for a
// creature that lists `moves` — known moves (universals included), subject self for the actor categories,
// positive turn rounds, unique card ids and a Default card.

const OP = fc.constantFrom('below' as const, 'atLeast' as const);
const PCT = fc.constantFrom(25 as const, 50 as const, 75 as const);
const SLICE_MOVES = [...new Set(Object.values(SPECIES).flatMap((s) => [...s.moves]))];

const arbCondition: fc.Arbitrary<Condition> = fc.oneof(
  fc.record({ category: fc.constantFrom('hp' as const, 'allyHp' as const, 'contextFill' as const), op: OP, pct: PCT }),
  fc.record({ category: fc.constant('status' as const), status: fc.constantFrom(...STATUS_IDS) }),
  fc.record({ category: fc.constant('foeType' as const), is: fc.constantFrom(...TYPES, 'weakToMove' as const) }),
  fc.record({ category: fc.constant('foeLastMove' as const), move: fc.constantFrom(...SLICE_MOVES) }),
  fc.record({ category: fc.constant('turn' as const), op: OP, round: fc.integer({ min: 1, max: 8 }) }),
  fc.record({ category: fc.constant('cooldown' as const), rounds: fc.constantFrom(1 as const, 2 as const, 3 as const) }),
  fc.record({ category: fc.constant('field' as const), effect: fc.constantFrom(...FIELD_KINDS) }),
  fc.record({ category: fc.constantFrom('foeBuffed' as const, 'telegraphing' as const, 'coin' as const) }),
);

const ACTOR = ['turn', 'cooldown', 'allyHp', 'coin'];

/** A card (id assigned later) over `moves`: a subject the condition allows, any selector, sometimes allowOverflow. */
const arbCard = (moves: readonly string[]): fc.Arbitrary<Omit<Card, 'id'>> =>
  fc
    .record({ condition: arbCondition, subject: fc.constantFrom<Subject>(...SUBJECTS), move: fc.constantFrom(...moves), target: fc.constantFrom(...TARGET_SELECTORS), overflow: fc.boolean() })
    .map(({ condition, subject, move, target, overflow }) => ({
      subject: ACTOR.includes(condition.category) ? 'self' : subject,
      condition,
      move,
      target,
      ...(overflow ? { allowOverflow: true as const } : {}),
    }));

/** 0-6 cards and a Default over the listed `moves` and the universal moves; ids c0, c1, … and def. */
export const arbDeck = (moves: readonly string[]): fc.Arbitrary<Deck> => {
  const known = [...moves, ...UNIVERSAL_MOVES];
  return fc.record({ cards: fc.array(arbCard(known), { maxLength: 6 }), last: arbCard(known) }).map(({ cards, last }) => ({
    cards: cards.map((c, i) => ({ id: `c${i}`, ...c })),
    default: { id: 'def', ...last },
  }));
};
