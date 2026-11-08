import { describe, expect, it } from 'vitest';
import type { Card, Condition, Deck } from '../../src/cards/model.js';
import { computeGeneralization, MAX_ACTIVE_SLOTS, scenarioHit } from '../../src/generalization/score.js';
import type { EvalScenario, EvalSuite, WastefulRule } from '../../src/generalization/model.js';
import { GeneralizationError, type GeneralizationErrorCode } from '../../src/generalization/errors.js';
import { VERSION_SLOTS } from '../../src/grid/adjacency.js';
import { card, vc, view } from '../cards/helpers.js';

// Generalization (spec §5 "Generalization"; Ruling 103). A synthetic suite of 12 scenarios at rounds 1…12 lets a
// `turn below n` card fire in exactly n − 1 of them; the `never` cards hold in none (no statuses, no telegraphing,
// no round-start draws), so they add a category without adding a hit.

const suite = (over: (round: number) => Partial<EvalScenario> = () => ({})): EvalSuite => ({
  id: 'synthetic',
  scenarios: Array.from({ length: 12 }, (_, i) => ({ id: `s${i + 1}`, view: view({ round: i + 1 }), wasteful: [], ...over(i + 1) })),
});
const SUITE = suite();

const c = (id: string, condition: Condition, over: Partial<Card> = {}): Card => card(condition, { id, ...over });
/** Fires in rounds 1 … n − 1, at the lowest-HP foe. */
const turnBelow = (id: string, n: number, move = 'token-burst'): Card => c(id, { category: 'turn', op: 'below', round: n }, { move });
const never = {
  hallucinating: (id: string, move = 'ship-it') => c(id, { category: 'status', status: 'hallucinating' }, { move }),
  glazed: (id: string, move = 'ship-it') => c(id, { category: 'status', status: 'glazed' }, { move }),
  telegraphing: (id: string, move = 'ship-it') => c(id, { category: 'telegraphing' }, { subject: 'foe', move }),
  coin: (id: string, move = 'ship-it') => c(id, { category: 'coin' }, { move }),
  field: (id: string, move = 'ship-it') => c(id, { category: 'field', effect: 'junkPerRound' }, { move }),
  foeBuffed: (id: string, move = 'ship-it') => c(id, { category: 'foeBuffed' }, { subject: 'foe', move }),
  foeLastMove: (id: string, move = 'ship-it') => c(id, { category: 'foeLastMove', move: 'hot-take' }, { subject: 'foe', move }),
};
/** Default always fires when nothing above does; its condition and move never count. */
const deck = (cards: Card[], def: Partial<Card> = {}): Deck => ({ cards, default: c('default', { category: 'turn', op: 'atLeast', round: 1 }, { move: 'token-burst', ...def }) });

describe('computeGeneralization: the brief’s worked example', () => {
  // 4 cards, 3 categories (turn, status, telegraphing); one same-category-same-move pair (the two status / ship-it
  // cards) of 6 pairs; the turn card fires in 9 of 12 scenarios.
  const worked = deck([turnBelow('a', 10), never.hallucinating('b'), never.telegraphing('c'), never.glazed('d')]);

  it('activeSlots 4: C = 3/4, R = 1/6, H = 3/4, G = 77 (Robust)', () => {
    expect(computeGeneralization(worked, SUITE, 4)).toEqual({ c: [3, 4], r: [1, 6], h: [3, 4], g: 77, band: 'robust' });
  });

  it('activeSlots 5: C = 3/5, G = 71', () => {
    expect(computeGeneralization(worked, SUITE, 5)).toEqual({ c: [3, 5], r: [1, 6], h: [3, 4], g: 71, band: 'robust' });
  });
});

describe('computeGeneralization: G, its rounding and its bands', () => {
  it('69 is Stable: C = 3/4, R = 0, H = 6/12 → 68.75', () => {
    const d = deck([turnBelow('a', 7), never.hallucinating('b'), never.glazed('c', 'token-burst'), never.telegraphing('d')]);
    expect(computeGeneralization(d, SUITE, 4)).toEqual({ c: [3, 4], r: [0, 1], h: [1, 2], g: 69, band: 'stable' });
  });

  it('70 is Robust: C = 1, R = 0, H = 4/12 → exactly 70', () => {
    const d = deck([turnBelow('a', 5), never.hallucinating('b'), never.telegraphing('c')]);
    expect(computeGeneralization(d, SUITE, 3)).toEqual({ c: [1, 1], r: [0, 1], h: [1, 3], g: 70, band: 'robust' });
  });

  it('39 is Brittle: one card, activeSlots 3, H = 2/12 → 39.17', () => {
    expect(computeGeneralization(deck([turnBelow('a', 3)]), SUITE, 3)).toEqual({ c: [1, 3], r: [0, 1], h: [1, 6], g: 39, band: 'brittle' });
  });

  it('rounds a half up (72.5 → 73), not to even', () => {
    const d = deck([turnBelow('a', 8), never.hallucinating('b'), never.glazed('c', 'token-burst'), never.telegraphing('d')]);
    expect(computeGeneralization(d, SUITE, 4)).toMatchObject({ c: [3, 4], r: [0, 1], h: [7, 12], g: 73 });
  });

  it('a 1-card deck has R = 0', () => {
    expect(computeGeneralization(deck([never.coin('a')]), SUITE, 3).r).toEqual([0, 1]);
  });

  it('caps the Coverage denominator at 6 and C at 1', () => {
    const seven = deck([never.hallucinating('a'), never.telegraphing('b'), never.coin('c'), never.field('d'), never.foeBuffed('e'), never.foeLastMove('f'), turnBelow('g', 1)]);
    expect(computeGeneralization(seven, SUITE, 7).c).toEqual([1, 1]);
    expect(computeGeneralization(deck([never.coin('a'), never.field('b')]), SUITE, 8).c).toEqual([1, 3]);
  });

  it('counts every same-category-same-move pair: three identical cards are 3 of 3 pairs', () => {
    expect(computeGeneralization(deck([never.coin('a'), never.coin('b'), never.coin('c')]), SUITE, 3).r).toEqual([1, 1]);
    // same category, different move, or same move, different category: not a pair
    expect(computeGeneralization(deck([never.coin('a'), never.coin('b', 'token-burst'), never.field('c')]), SUITE, 3).r).toEqual([0, 1]);
  });
});

describe('computeGeneralization: the Default card is excluded', () => {
  it('a Default-only deck: C = 0, R = 0, H = 0 (Default firing is never a hit), G = 20', () => {
    expect(computeGeneralization(deck([]), SUITE, 3)).toEqual({ c: [0, 1], r: [0, 1], h: [0, 1], g: 20, band: 'brittle' });
  });

  it('the Default card adds no category and forms no pair, even sharing a card’s category and move', () => {
    const d = deck([never.coin('a')], { condition: { category: 'coin' }, move: 'ship-it' });
    expect(computeGeneralization(d, SUITE, 3)).toMatchObject({ c: [1, 3], r: [0, 1], h: [0, 1] });
  });
});

describe('computeGeneralization: only active cards count (Ruling 103)', () => {
  it('a deck whose only non-Default cards are inactive scores like a Default-only deck', () => {
    const d = deck([turnBelow('a', 13), turnBelow('b', 13), never.coin('c')]);
    expect(computeGeneralization(d, SUITE, 0)).toEqual(computeGeneralization(deck([]), SUITE, 0));
    expect(computeGeneralization(d, SUITE, 0)).toEqual({ c: [0, 1], r: [0, 1], h: [0, 1], g: 20, band: 'brittle' });
  });

  it('inactive padding adds no Coverage: C reads the first min(activeSlots, cards) cards only', () => {
    const d = deck([never.coin('a'), never.coin('b', 'token-burst'), never.field('c'), never.foeBuffed('d'), never.telegraphing('e')]);
    expect(computeGeneralization(d, SUITE, 2).c).toEqual([1, 2]);
    expect(computeGeneralization(d, SUITE, 5).c).toEqual([4, 5]);
  });

  it('inactive cards form no pairs', () => {
    const d = deck([never.coin('a'), never.field('b'), never.foeBuffed('c'), never.foeBuffed('d')]);
    expect(computeGeneralization(d, SUITE, 3).r).toEqual([0, 1]);
    expect(computeGeneralization(d, SUITE, 4).r).toEqual([1, 6]);
  });

  it('an inactive card that would fire scores no hit', () => {
    const d = deck([never.coin('a'), turnBelow('b', 13)]);
    expect(computeGeneralization(d, SUITE, 1).h).toEqual([0, 1]);
    expect(computeGeneralization(d, SUITE, 2).h).toEqual([1, 1]);
  });
});

describe('computeGeneralization: Holdout and wasteful actions', () => {
  const HEAL_AT_FULL: WastefulRule[] = [{ kind: 'healAtFull' }];
  const always = (move: string, target: Card['target'] = 'self'): Card => c('always', { category: 'turn', op: 'atLeast', round: 1 }, { move, target });

  it('healing at full HP is wasteful: Community Patch on the full-HP actor scores no hit', () => {
    const full = suite(() => ({ wasteful: HEAL_AT_FULL }));
    expect(computeGeneralization(deck([always('community-patch')]), full, 3).h).toEqual([0, 1]);
  });

  it('the same heal while hurt is a hit; a rule a scenario does not list never applies', () => {
    const hurtIn5 = suite((r) => ({ wasteful: HEAL_AT_FULL, view: view({ round: r, self: vc(1, { hp: r <= 5 ? 40 : 100 }) }) }));
    expect(computeGeneralization(deck([always('community-patch')]), hurtIn5, 3).h).toEqual([5, 12]);
    expect(computeGeneralization(deck([always('community-patch')]), SUITE, 3).h).toEqual([1, 1]);
  });

  it('scenarioHit: a fired non-Default card whose action no listed rule flags as a whole no-op', () => {
    const s: EvalScenario = { id: 'x', view: view(), wasteful: HEAL_AT_FULL };
    expect(scenarioHit(deck([always('community-patch')]), s, 3)).toBe(false);
    expect(scenarioHit(deck([always('earnest-apology')]), s, 3)).toBe(true); // its damage reduction still lands (Ruling 106)
    expect(scenarioHit(deck([always('ship-it', 'lowestHpFoe')]), s, 3)).toBe(true);
    expect(scenarioHit(deck([never.coin('a')]), s, 3)).toBe(false); // only Default fires
  });

  it('a Default whose move a status forbids (a fallback) is not a hit', () => {
    const overfit = view({ self: vc(1, { statuses: ['overfit'] }), lastMoveId: 'ship-it' });
    const d = deck([never.coin('a')], { move: 'token-burst' });
    expect(scenarioHit(d, { id: 'x', view: overfit, wasteful: [] }, 3)).toBe(false);
  });
});

describe('computeGeneralization: exact fractions, determinism, inputs', () => {
  it('returns every fraction in lowest terms with a positive denominator, zero as [0, 1]', () => {
    const r = computeGeneralization(deck([turnBelow('a', 10), never.coin('b'), never.coin('c'), never.field('d')]), SUITE, 6);
    expect(r).toMatchObject({ c: [1, 2], r: [1, 6], h: [3, 4] }); // 3/6, 1/6, 9/12
    for (const [n, d] of [r.c, r.r, r.h]) {
      expect(Number.isSafeInteger(n) && Number.isSafeInteger(d) && d > 0).toBe(true);
    }
  });

  it('is deterministic and independent of call order, and never mutates its inputs', () => {
    const a = deck([turnBelow('a', 10), never.hallucinating('b'), never.telegraphing('c')]);
    const b = deck([never.coin('x'), turnBelow('y', 4)]);
    const snapshot = structuredClone({ a, b, SUITE });
    const ab = [computeGeneralization(a, SUITE, 3), computeGeneralization(b, SUITE, 2)];
    const ba = [computeGeneralization(b, SUITE, 2), computeGeneralization(a, SUITE, 3)].reverse();
    expect(ab).toEqual(ba);
    expect(computeGeneralization(a, SUITE, 3)).toEqual(ab[0]);
    expect({ a, b, SUITE }).toEqual(snapshot);
  });

});

describe('computeGeneralization: caller mistakes throw a typed GeneralizationError (Ruling 107)', () => {
  const codeOf = (f: () => unknown): GeneralizationErrorCode | null => {
    try {
      f();
      return null;
    } catch (e) {
      expect(e).toBeInstanceOf(GeneralizationError);
      expect((e as GeneralizationError).name).toBe('GeneralizationError');
      return (e as GeneralizationError).code;
    }
  };

  it('activeSlots: not an integer in 0..8, the v4 hard cap', () => {
    expect(MAX_ACTIVE_SLOTS).toBe(Math.max(...Object.values(VERSION_SLOTS)));
    for (const bad of [-1, 1.5, 9, Number.NaN, '3' as unknown as number]) expect(codeOf(() => computeGeneralization(deck([]), SUITE, bad))).toBe('activeSlots');
    expect(codeOf(() => computeGeneralization(deck([]), SUITE, 0))).toBeNull();
    expect(codeOf(() => computeGeneralization(deck([]), SUITE, 8))).toBeNull();
  });

  it('suiteSize: not exactly 12 scenarios', () => {
    expect(codeOf(() => computeGeneralization(deck([]), { id: 'short', scenarios: SUITE.scenarios.slice(1) }, 3))).toBe('suiteSize');
    expect(codeOf(() => computeGeneralization(deck([]), { id: 'long', scenarios: [...SUITE.scenarios, ...SUITE.scenarios.slice(0, 1)] }, 3))).toBe('suiteSize');
    expect(codeOf(() => computeGeneralization(deck([]), { id: 'none' } as unknown as EvalSuite, 3))).toBe('suiteSize');
  });

  it('deck: malformed — not shaped like a deck, no Default card, or a repeated card id', () => {
    const bad = (d: unknown) => codeOf(() => computeGeneralization(d as Deck, SUITE, 3));
    expect(bad(null)).toBe('deck');
    expect(bad({ cards: 'x', default: deck([]).default })).toBe('deck');
    expect(bad({ cards: [{ ...never.coin('a'), condition: { category: 'mood' } }], default: deck([]).default })).toBe('deck');
    expect(bad({ cards: [never.coin('a')] })).toBe('deck');
    expect(bad({ cards: [never.coin('a')], default: null })).toBe('deck');
    expect(bad(deck([never.coin('a'), never.field('a')]))).toBe('deck');
    expect(bad(deck([never.coin('default')]))).toBe('deck'); // a card sharing the Default's id would read as Default
    expect(bad(deck([never.coin('a')]))).toBeNull();
  });

  it('deck: a card naming an unknown move id — its move, its foeLastMove condition or its injection, the Default included (Ruling 119 m7)', () => {
    const bad = (d: Deck) => codeOf(() => computeGeneralization(d, SUITE, 3));
    expect(bad(deck([never.coin('a', 'no-such-move')]))).toBe('deck');
    expect(bad({ cards: [], default: { ...deck([]).default, move: 'no-such-move' } })).toBe('deck');
    expect(bad(deck([c('a', { category: 'foeLastMove', move: 'no-such-move' }, { subject: 'foe' })]))).toBe('deck');
    expect(bad(deck([never.coin('a', 'deepfake-call')].map((k) => ({ ...k, injection: { moveId: 'no-such-move', target: 'self' as const } }))))).toBe('deck');
    expect(bad(deck([never.coin('a', 'hard-fork'), never.foeLastMove('b')]))).toBeNull(); // every id known
  });
});
