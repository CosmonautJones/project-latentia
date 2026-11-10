import type { Card, CardTrace, Deck } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { cardText, explainTrace, summarizeTraces, type TraceContext } from '../../src/battle/card-text.js';
import { formatIntent, type IntentContext } from '../../src/battle/intent-text.js';

const c = (id: string, subject: Card['subject'], condition: Card['condition'], move: string, target: Card['target'] = 'lowestHpFoe'): Card => ({ id, subject, condition, move, target });

const MOVE_NAMES: Record<string, string> = { 'token-nibble': 'Token Nibble', 'token-burst': 'Token Burst', compact: 'Compact', 'community-patch': 'Community Patch' };
const moveName = (id: string) => MOVE_NAMES[id] ?? id;

const TOK_DECK: Deck = {
  cards: [
    c('heal', 'self', { category: 'allyHp', op: 'below', pct: 50 }, 'community-patch', 'lowestHpAlly'),
    c('nibble', 'foe', { category: 'hp', op: 'below', pct: 50 }, 'token-nibble'),
  ],
  default: c('default', 'self', { category: 'turn', op: 'atLeast', round: 1 }, 'token-burst'),
};

const ctx: TraceContext = {
  name: (i) => (i === 2 ? 'Tokenibble' : `#${i}`),
  moveName,
  deckOf: (i) => (i === 2 ? TOK_DECK : null),
};

const trace = (firedCardId: string, skipped: CardTrace['skipped'] = []): CardTrace => ({ round: 3, type: 'CardTrace', actor: 2, firedCardId, skipped });

describe('cardText', () => {
  it.each([
    [c('a', 'foe', { category: 'hp', op: 'below', pct: 50 }, 'token-nibble'), 'IF foe HP < 50% THEN Token Nibble'],
    [c('a', 'self', { category: 'hp', op: 'atLeast', pct: 75 }, 'token-nibble'), 'IF own HP >= 75% THEN Token Nibble'],
    [c('a', 'self', { category: 'turn', op: 'atLeast', round: 1 }, 'token-burst'), 'ALWAYS Token Burst'],
    [c('a', 'self', { category: 'turn', op: 'below', round: 2 }, 'token-burst'), 'IF round 1 THEN Token Burst'],
    [c('a', 'self', { category: 'coin' }, 'token-burst'), 'IF coin lands heads THEN Token Burst'],
    [c('a', 'self', { category: 'contextFill', op: 'atLeast', pct: 75 }, 'compact', 'self'), 'IF own context >= 75% full THEN Compact'],
    [c('a', 'foe', { category: 'foeType', is: 'weakToMove' }, 'token-burst'), 'IF foe is weak to it THEN Token Burst'],
    [c('a', 'foe', { category: 'status', status: 'rateLimited' }, 'token-burst'), 'IF foe is Rate Limited THEN Token Burst'],
    [c('a', 'self', { category: 'allyHp', op: 'below', pct: 50 }, 'community-patch'), 'IF an ally HP < 50% THEN Community Patch'],
  ])('%j reads as "%s"', (card, text) => {
    expect(cardText(card, moveName)).toBe(text);
  });
});

describe('explainTrace', () => {
  it('names the fired card and why each card above it was skipped, in plain words', () => {
    expect(explainTrace(trace('nibble', [{ cardId: 'heal', reason: 'conditionFalse' }]), ctx)).toBe(
      "Tokenibble fired 'IF foe HP < 50% THEN Token Nibble'; skipped 'Community Patch' (no ally below 50%).",
    );
  });

  it('says when it fell through to Default, and words every skip reason', () => {
    const text = explainTrace(
      trace('default', [
        { cardId: 'heal', reason: 'insufficientContext' },
        { cardId: 'nibble', reason: 'disobeyed' },
      ]),
      ctx,
    );
    expect(text).toBe("Tokenibble fell back to its Default, Token Burst; skipped 'Community Patch' (not enough free context), 'Token Nibble' (it ignored the card).");
  });

  it('copes with a card id the deck does not hold (a policy card) and an actor with no deck', () => {
    expect(explainTrace(trace('policy.x'), ctx)).toBe("Tokenibble fired card 'policy.x'.");
    expect(explainTrace({ ...trace('x'), actor: 0 }, ctx)).toBe("#0 fired card 'x'.");
  });

  it('states the opposite threshold plainly', () => {
    const deck: Deck = {
      cards: [c('tidy', 'self', { category: 'contextFill', op: 'atLeast', pct: 75 }, 'compact', 'self'), c('low', 'self', { category: 'hp', op: 'below', pct: 25 }, 'token-nibble')],
      default: TOK_DECK.default,
    };
    const text = explainTrace(trace('default', [{ cardId: 'tidy', reason: 'conditionFalse' }, { cardId: 'low', reason: 'conditionFalse' }]), { ...ctx, deckOf: () => deck });
    expect(text).toBe("Tokenibble fell back to its Default, Token Burst; skipped 'Compact' (own context below 75% full), 'Token Nibble' (own HP 25%+).");
  });

  it('negates every condition category without leaking ids', () => {
    const conds: Card['condition'][] = [
      { category: 'hp', op: 'atLeast', pct: 50 },
      { category: 'status', status: 'glazed' },
      { category: 'foeType', is: 'code' },
      { category: 'foeLastMove', move: 'token-burst' },
      { category: 'turn', op: 'below', round: 3 },
      { category: 'turn', op: 'atLeast', round: 4 },
      { category: 'cooldown', rounds: 2 },
      { category: 'allyHp', op: 'atLeast', pct: 75 },
      { category: 'field', effect: 'revealIntents' },
      { category: 'foeBuffed' },
      { category: 'contextFill', op: 'below', pct: 25 },
      { category: 'telegraphing' },
      { category: 'coin' },
    ];
    for (const condition of conds) {
      const deck: Deck = { cards: [c('x', 'foe', condition, 'token-burst')], default: TOK_DECK.default };
      const text = explainTrace(trace('default', [{ cardId: 'x', reason: 'conditionFalse' }]), { ...ctx, deckOf: () => deck });
      expect(text).toMatch(/skipped 'Token Burst' \([a-z][^)]+\)\.$/);
      expect(text).not.toMatch(/undefined|weakToMove|revealIntents|token-burst/);
    }
  });
});

describe('summarizeTraces', () => {
  it('counts what each deck-driven creature kept doing, most-fired card first', () => {
    const traces = [trace('nibble'), trace('nibble'), trace('default'), trace('nibble')];
    expect(summarizeTraces(traces, ctx)).toEqual(["Tokenibble: 'IF foe HP < 50% THEN Token Nibble' x3, Default Token Burst x1."]);
  });
});

describe('formatIntent', () => {
  const ictx: IntentContext = { shortName: (i) => ['SAGELET', 'BLITZR', 'TOKENIBBLE'][i] ?? '?', moveName };

  it('shows the move and its target', () => {
    expect(formatIntent({ actor: 1, moveId: 'token-burst', target: 0, cardId: 'jab' }, ictx, 40)).toBe('Token Burst → SAGELET');
  });

  it('a move on itself says so', () => {
    expect(formatIntent({ actor: 1, moveId: 'compact', target: 1, cardId: 'default' }, ictx, 40)).toBe('Compact (self)');
  });

  it('truncates to the width with an ellipsis', () => {
    const t = formatIntent({ actor: 1, moveId: 'community-patch', target: 2, cardId: null }, ictx, 16);
    expect(t).toBe('Community Patch…');
    expect([...t].length).toBe(16);
  });
});
