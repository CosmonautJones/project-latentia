import { describe, expect, it } from 'vitest';
import { createBattle, SetupError, validateSetup, type CreatureSetup } from '../../src/battle/setup.js';
import type { Card } from '../../src/cards/model.js';
import { gridlessSetup, mon, SEED } from './helpers.js';

// Deck validation (Review Focus 3, Ruling 82): validateSetup rejects decks with no Default, unknown moves or
// moves the creature does not know, requires subject 'self' for the actor categories, and is shape-safe.

const card = (over: Record<string, unknown> = {}): Card =>
  ({ id: 'c1', subject: 'self', condition: { category: 'hp', op: 'below', pct: 50 }, move: 'ship-it', target: 'lowestHpFoe', ...over }) as Card;
const DEF = card({ id: 'def', move: 'compact', target: 'self' });

/** a-act1 is a Blitzr (ship-it, token-burst, low-latency, distilled-strike) carrying `deck`. */
const withDeck = (deck: unknown) => gridlessSetup({ active: [{ ...mon('a-act1', 'blitzr'), deck } as CreatureSetup, mon('a-act2', 'forkling')] });
const errors = (deck: unknown) => validateSetup(withDeck(deck)).errors.map((e) => [e.code, e.path]);

describe('deck validation', () => {
  it('accepts a deck of known moves (universals included) and a Default-only deck', () => {
    expect(validateSetup(withDeck({ cards: [card(), card({ id: 'c2', move: 'guardrail', target: 'self', allowOverflow: true, recordedFrom: 'b' })], default: DEF }))).toEqual({ ok: true, errors: [] });
    expect(validateSetup(withDeck({ cards: [], default: DEF })).ok).toBe(true);
  });

  it('rejects a deck with no Default card (deckDefault)', () => {
    expect(errors({ cards: [card()] })).toEqual([['deckDefault', 'a.active[0].deck.default']]);
    expect(errors({ cards: [card()], default: null })).toEqual([['deckDefault', 'a.active[0].deck.default']]);
  });

  it('rejects an unknown move (unknownId) and a move the creature does not know (moveNotKnown), on any card', () => {
    expect(errors({ cards: [card({ move: 'no-such-move' })], default: DEF })).toEqual([['unknownId', 'a.active[0].deck.cards[0].move']]);
    expect(errors({ cards: [card({ move: 'hard-fork' })], default: card({ id: 'def', move: 'happy-to-help' }) })).toEqual([
      ['moveNotKnown', 'a.active[0].deck.cards[0].move'],
      ['moveNotKnown', 'a.active[0].deck.default.move'],
    ]);
    // a lever is not a move anyone knows
    expect(errors({ cards: [card({ move: 'directive' })], default: DEF })).toEqual([['moveNotKnown', 'a.active[0].deck.cards[0].move']]);
    // a known move the subagent did not list
    const short = gridlessSetup({ active: [{ ...mon('a-act1', 'blitzr'), moves: ['ship-it'], deck: { cards: [card({ move: 'token-burst' })], default: DEF } }] });
    expect(validateSetup(short).errors.map((e) => e.code)).toEqual(['moveNotKnown']);
  });

  it('checks the move ids inside conditions and injections', () => {
    expect(errors({ cards: [card({ subject: 'foe', condition: { category: 'foeLastMove', move: 'nope' } })], default: DEF })).toEqual([['unknownId', 'a.active[0].deck.cards[0].condition.move']]);
    expect(errors({ cards: [card({ injection: { moveId: 'nope', target: 'self' } })], default: DEF })).toEqual([['unknownId', 'a.active[0].deck.cards[0].injection.moveId']]);
  });

  it('requires subject self for turn, cooldown, allyHp and coin (cardSubject)', () => {
    const actor = [
      { category: 'turn', op: 'below', round: 3 },
      { category: 'cooldown', rounds: 2 },
      { category: 'allyHp', op: 'below', pct: 50 },
      { category: 'coin' },
    ];
    for (const condition of actor) {
      expect(errors({ cards: [card({ subject: 'self', condition })], default: DEF })).toEqual([]);
      expect(errors({ cards: [card({ subject: 'foe', condition })], default: DEF })).toEqual([['cardSubject', 'a.active[0].deck.cards[0].subject']]);
    }
    expect(errors({ cards: [], default: card({ id: 'def', subject: 'orchestrator', condition: { category: 'coin' } }) })).toEqual([['cardSubject', 'a.active[0].deck.default.subject']]);
  });

  it('rejects duplicate card ids (Default included) and a turn round that is not a positive integer', () => {
    expect(errors({ cards: [card(), card()], default: DEF })).toEqual([['duplicateId', 'a.active[0].deck.cards[1].id']]);
    expect(errors({ cards: [card({ id: 'def' })], default: DEF })).toEqual([['duplicateId', 'a.active[0].deck.default.id']]);
    for (const round of [0, -1, 1.5]) {
      expect(errors({ cards: [card({ condition: { category: 'turn', op: 'below', round } })], default: DEF })).toEqual([['range', 'a.active[0].deck.cards[0].condition.round']]);
    }
  });

  it('validates an orchestrator’s deck against its own moveset', () => {
    const s = gridlessSetup({ orchestrator: { ...mon('a-orch', 'sagelet'), deck: { cards: [card({ move: 'chain-of-thought' }), card({ id: 'c2' })], default: DEF } } });
    expect(validateSetup(s).errors.map((e) => [e.code, e.path])).toEqual([['moveNotKnown', 'a.orchestrator.deck.cards[1].move']]);
  });

  it('is shape-safe on malformed decks: code shape, never a throw, and nothing else is checked', () => {
    const malformed: unknown[] = [
      5,
      null,
      [],
      { cards: 'x', default: DEF },
      { cards: [5], default: DEF },
      { cards: [], default: 'def' },
      { cards: [card({ id: 3 })], default: DEF },
      { cards: [card({ subject: 'boss' })], default: DEF },
      { cards: [card({ condition: null })], default: DEF },
      { cards: [card({ condition: { category: 'mood' } })], default: DEF },
      { cards: [card({ condition: { category: 'hp', op: 'below', pct: 30 } })], default: DEF },
      { cards: [card({ condition: { category: 'hp', op: 'under', pct: 50 } })], default: DEF },
      { cards: [card({ condition: { category: 'status', status: 'sleepy' } })], default: DEF },
      { cards: [card({ condition: { category: 'foeType', is: 'fire' } })], default: DEF },
      { cards: [card({ condition: { category: 'foeLastMove', move: 4 } })], default: DEF },
      { cards: [card({ condition: { category: 'turn', op: 'below', round: '3' } })], default: DEF },
      { cards: [card({ condition: { category: 'cooldown', rounds: 4 } })], default: DEF },
      { cards: [card({ condition: { category: 'field', effect: 'rain' } })], default: DEF },
      { cards: [card({ move: 7 })], default: DEF },
      { cards: [card({ target: 'everyone' })], default: DEF },
      { cards: [card({ allowOverflow: false })], default: DEF },
      { cards: [card({ recordedFrom: 1 })], default: DEF },
      { cards: [card({ injection: { moveId: 'ship-it', target: 'all' } })], default: DEF },
      { cards: [card({ injection: 'ship-it' })], default: DEF },
    ];
    for (const deck of malformed) {
      const r = validateSetup(withDeck(deck));
      expect(r.ok).toBe(false);
      expect(r.errors.map((e) => e.code)).toEqual(['shape']);
      expect(r.errors[0]?.path.startsWith('a.active[0].deck')).toBe(true);
    }
  });

  it('createBattle throws SetupError for an invalid deck', () => {
    expect(() => createBattle(withDeck({ cards: [card()] }), SEED)).toThrow(SetupError);
  });
});
