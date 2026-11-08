import { describe, expect, it } from 'vitest';
import { activeCards, specialistApplies } from '../../src/battle/levers.js';
import type { BattleState } from '../../src/battle/state.js';
import type { Card, Condition, Deck } from '../../src/cards/model.js';
import { dealt, expected, fresh, ofType, run } from './effects/kit.js';
import { at } from './helpers.js';

// Task B3 (spec §5 "Cards, decks and traces"; Rulings 72, 81): the Specialist damage modifier and a deck card's
// Prompt Injected preference. Canonical indices (kit.fresh): 0 a-orch Sagelet, 1 a-act1 Blitzr, 2 a-act2 Forkling,
// 6 b-orch Sagelet, 7 b-act1 Blitzr, 8 b-act2 Forkling; everyone at 500 HP. Side a faces opponent id 'b'.

const T: Condition = { category: 'hp', op: 'atLeast', pct: 25 };
const F: Condition = { category: 'hp', op: 'below', pct: 25 };
const card = (id: string, move: string, over: Partial<Card> = {}): Card => ({ id, subject: 'self', condition: T, move, target: 'lowestHpFoe', ...over });
const traceOf = (events: ReturnType<typeof run>, actor: number) => ofType(events, 'CardTrace').find((e) => e.actor === actor);

describe('Specialist (spec §5; Ruling 81)', () => {
  const rec = (id: string, from?: string): Card => card(id, 'ship-it', from === undefined ? {} : { recordedFrom: from });

  it('specialistApplies: at least half the active non-Default cards recorded from the opponent id', () => {
    expect(specialistApplies({ cards: [], default: rec('d', 'b') }, 'b', 3)).toBe(false);
    expect(specialistApplies({ cards: [rec('1', 'b')], default: rec('d') }, 'b', 3)).toBe(true);
    expect(specialistApplies({ cards: [rec('1', 'b'), rec('2')], default: rec('d') }, 'b', 3)).toBe(true);
    expect(specialistApplies({ cards: [rec('1', 'b'), rec('2'), rec('3', 'c')], default: rec('d', 'b') }, 'b', 3)).toBe(false);
    expect(specialistApplies({ cards: [rec('1', 'b'), rec('2', 'b')], default: rec('d') }, 'c', 3)).toBe(false);
  });

  it('counts only the active cards (Ruling 116): inactive recorded padding unlocks nothing', () => {
    const general = [rec('g1'), rec('g2'), rec('g3')];
    const recorded = [rec('r1', 'b'), rec('r2', 'b'), rec('r3', 'b')];
    expect(specialistApplies({ cards: [...general, ...recorded], default: rec('d') }, 'b', 3)).toBe(false);
    expect(specialistApplies({ cards: [...recorded, ...general], default: rec('d') }, 'b', 3)).toBe(true);
    expect(specialistApplies({ cards: [rec('g1'), rec('r1', 'b'), rec('g2')], default: rec('d') }, 'b', 2)).toBe(true); // 1 of the top 2
    expect(specialistApplies({ cards: [rec('r1', 'b')], default: rec('d') }, 'b', 0)).toBe(false); // no active card
  });

  /** a-act1 Blitzr's Ship It on b-act1 Blitzr (neutral, native, 100% roll at T2) with a half-recorded deck. */
  const shipIt = (from: string | null): { s: BattleState; got: number[] } => {
    const s = fresh();
    if (from !== null) at(s, 1).deck = { cards: [rec('1', from), rec('2')], default: rec('d') };
    return { s, got: dealt(run(s, 1, 'ship-it', 7)) };
  };
  const base = { type: 10000, native: 12500, roll: 10000 };

  it('in battle, uses the top activeCards cards: 3 recorded cards in inactive slots give no modifier, in active slots they do', () => {
    const general = [rec('g1'), rec('g2'), rec('g3')];
    const recorded = [rec('r1', 'b'), rec('r2', 'b'), rec('r3', 'b')];
    const hit = (cards: Card[]): { s: BattleState; got: number[] } => {
      const s = fresh();
      at(s, 1).deck = { cards, default: rec('d') };
      expect(activeCards(s, at(s, 1))).toBe(3); // gridless v1: three active cards
      return { s, got: dealt(run(s, 1, 'ship-it', 7)) };
    };
    const padded = hit([...general, ...recorded]);
    expect(padded.got).toEqual([expected(padded.s, 1, 7, 65, base)]);
    const active = hit([...recorded, ...general]);
    expect(active.got).toEqual([expected(active.s, 1, 7, 65, { ...base, specialist: 11500 })]);
  });

  it('deals the 11500 modifier only against the opponent id the side faces', () => {
    const match = shipIt('b'); // side a faces opponent id 'b'
    expect(match.got).toEqual([expected(match.s, 1, 7, 65, { ...base, specialist: 11500 })]);
    expect(match.got[0]).toBeGreaterThan(expected(match.s, 1, 7, 65, base));
    const other = shipIt('ghost-1');
    expect(other.got).toEqual([expected(other.s, 1, 7, 65, base)]);
    expect(shipIt(null).got).toEqual(other.got);
  });

  it('never applies to a same-side hit: a Prompt Injected Specialist hitting its own ally', () => {
    const hit = (deck: boolean): number[] => {
      const s = fresh();
      if (deck) at(s, 1).deck = { cards: [rec('1', 'b'), rec('2', 'b')], default: rec('d') };
      at(s, 1).statuses.push({ id: 'promptInjected', remaining: 1, injected: { moveId: 'ship-it', target: 2 } });
      const events = run(s, 1, 'ship-it', 7);
      expect(ofType(events, 'MoveUsed')).toEqual([{ round: 1, type: 'MoveUsed', actor: 1, moveId: 'ship-it', target: 2 }]);
      return dealt(events);
    };
    expect(hit(true)).toEqual(hit(false));
  });

  it('never applies to an orchestrator', () => {
    const hit = (deck: boolean): number[] => {
      const s = fresh();
      if (deck) at(s, 0).deck = { cards: [card('1', 'happy-to-help', { recordedFrom: 'b' })], default: card('d', 'happy-to-help') };
      return dealt(run(s, 0, 'happy-to-help', 7));
    };
    expect(hit(true)).toEqual(hit(false));
  });
});

describe("a deck card's injection preference (spec §5 Prompt Injected; Ruling 72)", () => {
  const DEEP = (injection?: Card['injection']): Deck => ({ cards: [card('deep', 'deepfake-call', injection === undefined ? {} : { injection })], default: card('d', 'ship-it') });
  const injectedOf = (s: BattleState, i: number) => at(s, i).statuses.find((x) => x.id === 'promptInjected')?.injected;

  it("is stored when the card's Deepfake Call lands, its selector resolved against the victim's view", () => {
    const s = fresh();
    at(s, 1).deck = DEEP({ moveId: 'token-burst', target: 'lowestHpAlly' });
    at(s, 8).hp = 100; // the victim's lowest-HP ally
    const events = run(s, 1, 'deepfake-call', 7, {}, { cardId: 'deep', skipped: [] });
    expect(traceOf(events, 1)?.firedCardId).toBe('deep');
    expect(injectedOf(s, 7)).toEqual({ moveId: 'token-burst', target: 8 });
  });

  it('falls back to the default choice without a preference, or when the victim does not know its move', () => {
    for (const deck of [DEEP(), DEEP({ moveId: 'hard-fork', target: 'lowestHpAlly' })]) {
      const s = fresh();
      at(s, 1).deck = deck;
      at(s, 8).hp = 100;
      run(s, 1, 'deepfake-call', 7, {}, { cardId: 'deep', skipped: [] });
      // Blitzr's highest-power move, at its lowest-HP ally (b-act2).
      expect(injectedOf(s, 7)).toEqual({ moveId: 'distilled-strike', target: 8 });
    }
  });

  // A Brittle repeat fires the Default card (CardTrace names it), so its injection is the Default card's — used
  // only when the repeat move is the Default's own move (resolve.ts cardInjection); otherwise the default choice.
  it("a Brittle repeat whose move is the Default's uses the Default card's injection; another repeat move does not", () => {
    const repeat = (defaultMove: string) => {
      const s = fresh();
      at(s, 1).generalization = 10; // Brittle
      at(s, 1).deck = {
        cards: [card('x', 'deepfake-call', { condition: F }), card('y', 'deepfake-call', { condition: F })],
        default: card('d', defaultMove, { injection: { moveId: 'token-burst', target: 'lowestHpAlly' } }),
      };
      at(s, 8).hp = 100;
      const events = run(s, 1, 'deepfake-call', 7, {}, { cardId: 'd', skipped: [] });
      expect(ofType(events, 'BrittleRepeat')).toEqual([{ round: 1, type: 'BrittleRepeat', actor: 1, moveId: 'deepfake-call' }]);
      expect(traceOf(events, 1)?.firedCardId).toBe('d');
      return injectedOf(s, 7);
    };
    expect(repeat('deepfake-call')).toEqual({ moveId: 'token-burst', target: 8 });
    expect(repeat('ship-it')).toEqual({ moveId: 'distilled-strike', target: 8 });
  });

  it('a command injection still wins for an orchestrator move (no card)', () => {
    const s = fresh();
    run(s, 0, 'deepfake-call', 7, {}, { injection: { moveId: 'ship-it', target: 6 } });
    expect(injectedOf(s, 7)).toEqual({ moveId: 'ship-it', target: 6 });
  });
});
