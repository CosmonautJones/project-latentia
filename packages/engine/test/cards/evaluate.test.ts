import { describe, expect, it } from 'vitest';
import { bandFor, evaluateDeck, obeys, type Band } from '../../src/cards/evaluate.js';
import type { Card, Condition, Deck } from '../../src/cards/model.js';
import { card, vc, view, word } from './helpers.js';

// Deck evaluation (spec §5 "Cards, decks and traces"). The helper view: actor 1 (12 cells free), orchestrator 0,
// ally 2, foes 6, 7, 8 (all at 100 HP, so lowestHpFoe is 6), round 3.

const T: Condition = { category: 'hp', op: 'atLeast', pct: 25 }; // holds for the healthy actor
const F: Condition = { category: 'hp', op: 'below', pct: 25 }; // never holds for it

const c = (id: string, condition: Condition, over: Partial<Card> = {}): Card => card(condition, { id, ...over });
const deck = (cards: Card[], def: Partial<Card> = {}): Deck => ({ cards, default: c('def', T, { move: 'compact', target: 'self', ...def }) });
const STABLE = { band: 'stable' as Band };

describe('evaluateDeck: top-down over the active cards, then Default', () => {
  it('fires the first card whose condition holds and whose move is usable, tracing the ones above it', () => {
    const d = deck([c('a', F), c('b', T, { move: 'token-burst' }), c('c', T)]);
    expect(evaluateDeck(d, view(), 3, STABLE)).toEqual({
      cardId: 'b',
      moveId: 'token-burst',
      target: 6,
      trace: { firedCardId: 'b', skipped: [{ cardId: 'a', reason: 'conditionFalse' }] },
      brittleRepeat: false,
      replanned: false,
    });
  });

  it('evaluates only the top N cards; cards beyond N are traced notActive on the way to Default', () => {
    const d = deck([c('a', F), c('b', T), c('c', T)]);
    expect(evaluateDeck(d, view(), 1, STABLE)).toMatchObject({
      cardId: 'def',
      moveId: 'compact',
      target: 1,
      trace: {
        firedCardId: 'def',
        skipped: [
          { cardId: 'a', reason: 'conditionFalse' },
          { cardId: 'b', reason: 'notActive' },
          { cardId: 'c', reason: 'notActive' },
        ],
      },
    });
    expect(evaluateDeck(d, view(), 0, STABLE).trace.skipped.map((s) => s.reason)).toEqual(['notActive', 'notActive', 'notActive']);
    // b fires inside N = 2: c is never reached, so it is not traced
    expect(evaluateDeck(d, view(), 2, STABLE).trace).toEqual({ firedCardId: 'b', skipped: [{ cardId: 'a', reason: 'conditionFalse' }] });
  });

  it('a Default-only deck fires its Default', () => {
    expect(evaluateDeck(deck([]), view(), 3, STABLE)).toMatchObject({ cardId: 'def', moveId: 'compact', target: 1, trace: { firedCardId: 'def', skipped: [] } });
  });

  it('skips a move costing more cells than are free as insufficientContext, unless the card has allowOverflow', () => {
    const full = view({ self: vc(1, { contextUsed: 11 }) }); // 1 cell free
    const d = deck([c('fork', T, { move: 'hard-fork' }), c('ship', T, { move: 'ship-it' })]); // costs 2, then 1
    expect(evaluateDeck(d, full, 3, STABLE).trace).toEqual({ firedCardId: 'ship', skipped: [{ cardId: 'fork', reason: 'insufficientContext' }] });
    const overflow = deck([c('fork', T, { move: 'hard-fork', allowOverflow: true })]);
    expect(evaluateDeck(overflow, full, 3, STABLE).cardId).toBe('fork');
  });

  it('counts the cost as resolution pays it: pending costSet / costAdd, then Quantized −1', () => {
    const full = vc(1, { contextUsed: 11 });
    const fork = deck([c('fork', T, { move: 'hard-fork' })]);
    expect(evaluateDeck(fork, view({ self: full, pendingCost: [{ kind: 'costSet', cells: 0 }] }), 3, STABLE).cardId).toBe('fork');
    expect(evaluateDeck(fork, view({ self: { ...full, statuses: ['quantized'] } }), 3, STABLE).cardId).toBe('fork');
    const ship = deck([c('ship', T, { move: 'ship-it' })]);
    expect(evaluateDeck(ship, view({ self: full }), 3, STABLE).cardId).toBe('ship');
    expect(evaluateDeck(ship, view({ self: full, pendingCost: [{ kind: 'costAdd', cells: 1 }] }), 3, STABLE).trace.skipped).toEqual([
      { cardId: 'ship', reason: 'insufficientContext' },
    ]);
  });

  it('skips a move a held status forbids as moveDisabled: Overfit reads lastMoveId (not the last executed move), Glazed forbids status moves', () => {
    const overfit = view({ self: vc(1, { statuses: ['overfit'], lastMove: 'token-burst' }), lastMoveId: 'ship-it' });
    const d = deck([c('burst', T, { move: 'token-burst' }), c('ship', T, { move: 'ship-it' })]);
    expect(evaluateDeck(d, overfit, 3, STABLE).trace).toEqual({ firedCardId: 'ship', skipped: [{ cardId: 'burst', reason: 'moveDisabled' }] });
    const glazed = view({ self: vc(1, { statuses: ['glazed'] }) });
    const g = deck([c('buff', T, { move: 'low-latency' }), c('ship', T, { move: 'ship-it' })]);
    expect(evaluateDeck(g, glazed, 3, STABLE).trace.skipped).toEqual([{ cardId: 'buff', reason: 'moveDisabled' }]);
  });

  it('a card whose selector gives no legal target for its move does not fire (conditionFalse); self moves aim at the actor', () => {
    const d = deck([c('orchT', T, { target: 'orchestratorTarget' }), c('selfFoe', T, { target: 'self' }), c('buff', T, { move: 'low-latency', target: 'lowestHpFoe' })]);
    expect(evaluateDeck(d, view(), 3, STABLE)).toMatchObject({
      cardId: 'buff',
      target: 1,
      trace: {
        skipped: [
          { cardId: 'orchT', reason: 'conditionFalse' },
          { cardId: 'selfFoe', reason: 'conditionFalse' },
        ],
      },
    });
    expect(evaluateDeck(d, view({ orchestratorTarget: 8 }), 3, STABLE)).toMatchObject({ cardId: 'orchT', target: 8 });
  });

  it('Default fires whatever its condition, at its selector’s pick or else at the move’s default selector', () => {
    const v = view({ foes: [vc(6, { isOrchestrator: true }), vc(7, { hp: 50 }), vc(8)] });
    expect(evaluateDeck(deck([], { condition: F, move: 'ship-it', target: 'highestAtkFoe' }), v, 3, STABLE)).toMatchObject({ cardId: 'def', moveId: 'ship-it', target: 6 });
    // `orchestrator` is not a foe: ship-it falls back to the lowest-HP foe
    expect(evaluateDeck(deck([], { condition: F, move: 'ship-it', target: 'orchestrator' }), v, 3, STABLE)).toMatchObject({ cardId: 'def', target: 7 });
    expect(evaluateDeck(deck([], { move: 'ship-it', target: 'lowestHpFoe' }), view({ foes: [] }), 3, STABLE).target).toBeNull();
  });
});

describe('obedience (D1 lo)', () => {
  it('bandFor: Robust ≥ 70, Stable 40–69, Brittle < 40', () => {
    expect([100, 70, 69, 40, 39, 0].map(bandFor)).toEqual(['robust', 'robust', 'stable', 'stable', 'brittle', 'brittle']);
  });

  it('obeys when lo(D1, 100) < 100 / 95 / 85; the high half is ignored', () => {
    expect(obeys('robust', word(0, 99))).toBe(true);
    expect([94, 95].map((l) => obeys('stable', word(0xffff, l)))).toEqual([true, false]);
    expect([84, 85].map((l) => obeys('brittle', word(0, l)))).toEqual([true, false]);
    expect(obeys('brittle', word(0, 100 + 84))).toBe(true); // mod 100
  });

  it('on a failed roll the next matching card below fires and the skipped one is traced disobeyed; one roll only', () => {
    const d = deck([c('a', T), c('b', F), c('c', T, { move: 'token-burst' }), c('e', T)]);
    expect(evaluateDeck(d, view(), 4, { band: 'brittle', d1: word(0, 84) }).cardId).toBe('a');
    expect(evaluateDeck(d, view(), 4, { band: 'brittle', d1: word(0, 85) })).toMatchObject({
      cardId: 'c',
      moveId: 'token-burst',
      brittleRepeat: false,
      trace: {
        firedCardId: 'c',
        skipped: [
          { cardId: 'a', reason: 'disobeyed' },
          { cardId: 'b', reason: 'conditionFalse' },
        ],
      },
    });
    expect(evaluateDeck(d, view(), 4, { band: 'stable', d1: word(0, 95) }).cardId).toBe('c');
    expect(evaluateDeck(d, view(), 4, { band: 'robust', d1: word(0, 99) }).cardId).toBe('a');
  });

  it('with nothing matching below the disobeyed card, Default fires (not a Brittle repeat); Default itself is never disobeyed', () => {
    const d = deck([c('a', T, { move: 'token-burst' }), c('b', F, { move: 'token-burst' })]);
    expect(evaluateDeck(d, view(), 2, { band: 'brittle', d1: word(0, 99) })).toMatchObject({ cardId: 'def', moveId: 'compact', brittleRepeat: false });
    expect(evaluateDeck(deck([c('a', F)]), view(), 1, { band: 'stable', d1: word(0, 99) })).toMatchObject({ cardId: 'def', trace: { skipped: [{ cardId: 'a', reason: 'conditionFalse' }] } });
  });
});

describe('Brittle repeat', () => {
  it('when no non-Default card fires, a Brittle creature uses its most-represented move, aimed by its first card holding it', () => {
    const d = deck([c('a', F, { move: 'ship-it' }), c('b', F, { move: 'token-burst', target: 'highestAtkFoe' }), c('e', F, { move: 'token-burst' })]);
    const v = view({ foes: [vc(6), vc(7), vc(8, { compute: 90 })] });
    expect(evaluateDeck(d, v, 3, { band: 'brittle' })).toEqual({
      cardId: 'def',
      moveId: 'token-burst',
      target: 8,
      trace: {
        firedCardId: 'def',
        skipped: [
          { cardId: 'a', reason: 'conditionFalse' },
          { cardId: 'b', reason: 'conditionFalse' },
          { cardId: 'e', reason: 'conditionFalse' },
        ],
      },
      brittleRepeat: true,
      replanned: false,
    });
    // inactive cards count towards the most-represented move
    expect(evaluateDeck(d, v, 1, { band: 'brittle' })).toMatchObject({ moveId: 'token-burst', brittleRepeat: true });
    expect(evaluateDeck(d, v, 3, STABLE)).toMatchObject({ moveId: 'compact', brittleRepeat: false });
  });

  it('ties go to the move that appears first in deck order; a Default-only deck just fires its Default', () => {
    const d = deck([c('a', F, { move: 'token-burst' }), c('b', F, { move: 'ship-it' }), c('e', F, { move: 'ship-it' }), c('f', F, { move: 'token-burst' })]);
    expect(evaluateDeck(d, view(), 4, { band: 'brittle' })).toMatchObject({ moveId: 'token-burst', brittleRepeat: true });
    expect(evaluateDeck(deck([]), view(), 3, { band: 'brittle' })).toMatchObject({ moveId: 'compact', brittleRepeat: false });
  });
});

describe('startAfter and resume', () => {
  const d = deck([c('a', T), c('b', T, { move: 'token-burst' }), c('e', T, { move: 'distilled-strike' })]);

  it('startAfter begins below the named card (the trace holds only what was evaluated)', () => {
    expect(evaluateDeck(d, view(), 3, { ...STABLE, startAfter: 'a' }).trace).toEqual({ firedCardId: 'b', skipped: [] });
    expect(evaluateDeck(d, view(), 3, { ...STABLE, startAfter: 'e' }).cardId).toBe('def');
  });

  it('resume re-validates the intent’s card and keeps its plan-time target while that target is still legal', () => {
    const r = evaluateDeck(d, view(), 3, { ...STABLE, resume: { cardId: 'b', target: 8 } });
    expect(r).toMatchObject({ cardId: 'b', target: 8, replanned: false, trace: { skipped: [] } });
    // a randomFoe intent keeps its pick even though the draws are gone from the view
    const rand = deck([c('r', T, { target: 'randomFoe' })]);
    expect(evaluateDeck(rand, view(), 3, { ...STABLE, resume: { cardId: 'r', target: 7 } })).toMatchObject({ cardId: 'r', target: 7, replanned: false });
  });

  it('when the intent’s target is gone or its condition no longer holds, evaluation continues from the next card down, replanned', () => {
    const gone = view({ foes: [vc(6, { isOrchestrator: true }), vc(7)] });
    expect(evaluateDeck(d, gone, 3, { ...STABLE, resume: { cardId: 'b', target: 8 } })).toMatchObject({
      cardId: 'e',
      target: 6,
      replanned: true,
      trace: { skipped: [{ cardId: 'b', reason: 'conditionFalse' }] },
    });
    const weak = view({ self: vc(1, { hp: 10 }) });
    expect(evaluateDeck(d, weak, 3, { ...STABLE, resume: { cardId: 'a', target: 6 } })).toMatchObject({ cardId: 'def', replanned: true });
  });

  it('a resumed Default keeps a legal target, else re-aims (replanned)', () => {
    const shipDef = deck([], { move: 'ship-it', target: 'lowestHpFoe' });
    expect(evaluateDeck(shipDef, view(), 3, { ...STABLE, resume: { cardId: 'def', target: 8 } })).toMatchObject({ target: 8, replanned: false });
    const gone = view({ foes: [vc(6, { isOrchestrator: true }), vc(7)] });
    expect(evaluateDeck(shipDef, gone, 3, { ...STABLE, resume: { cardId: 'def', target: 8 } })).toMatchObject({ target: 6, replanned: true });
  });
});
