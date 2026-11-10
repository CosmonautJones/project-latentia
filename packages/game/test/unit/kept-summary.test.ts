import { createBattle, moveDef, simulate, type BattleEvent, type Card, type Deck } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { naiveCommand } from '../../scripts/loop-balance.js';
import { trainerBattle } from '../../src/content/battles.js';
import { graftSummary, keptSummary, type KeptCreature } from '../../src/journey/kept-summary.js';

const moveName = (id: string) => moveDef(id)?.name ?? id;
const ALWAYS = { category: 'turn', op: 'atLeast', round: 1 } as const;
const c = (id: string, condition: Card['condition'], move: string, subject: Card['subject'] = 'self'): Card => ({ id, subject, condition, move, target: 'lowestHpFoe' });
const DECK: Deck = { cards: [c('taught', { category: 'hp', op: 'atLeast', pct: 50 }, 'low-latency')], default: c('default', ALWAYS, 'token-burst') };
const FINISHER: Deck = { cards: [c('taught', { category: 'hp', op: 'below', pct: 50 }, 'early-exit', 'foe')], default: c('default', ALWAYS, 'token-burst') };

// You (index 0, 20 HP), Tokenibble (1), the foe (2).
const CREATURES: KeptCreature[] = [
  { index: 0, side: 0, isOrchestrator: true, hp: 20, maxHp: 20, name: 'Blitzr' },
  { index: 1, side: 0, isOrchestrator: false, hp: 15, maxHp: 15, name: 'Tokenibble' },
  { index: 2, side: 1, isOrchestrator: true, hp: 30, maxHp: 30, name: "Bootcamp Grad's Vibrat" },
];
const traceEv = (round: number, firedCardId: string, skipped: { cardId: string; reason: 'conditionFalse' }[] = []): BattleEvent => ({ round, type: 'CardTrace', actor: 1, firedCardId, skipped });
const hit = (round: number, target: number, amount: number, hpAfter: number): BattleEvent => ({ round, type: 'Damage', actor: 2, target, amount, hpAfter });

const summary = (events: BattleEvent[], deck: Deck = DECK) => keptSummary({ events, creatures: CREATURES, deckOf: (i) => (i === 1 ? deck : null), moveName });

describe('keptSummary: what Tokenibble kept doing, in plain words', () => {
  it('names the move it kept using, out of how many turns, and how many of those came while you were under half HP', () => {
    const lines = summary([traceEv(1, 'taught'), hit(1, 0, 6, 14), traceEv(2, 'taught'), hit(2, 0, 5, 9), traceEv(3, 'taught'), traceEv(4, 'taught'), { round: 4, type: 'Fainted', target: 0 }]);
    expect(lines[0]).toBe('Tokenibble kept using Low Latency: 4 of 4 turns, 2 of them while you were under half HP.');
  });

  it('mentions the rest of what it did, its Default included', () => {
    const lines = summary([traceEv(1, 'taught'), traceEv(2, 'taught'), traceEv(3, 'default', [{ cardId: 'taught', reason: 'conditionFalse' }])]);
    expect(lines[0]).toBe('Tokenibble kept using Low Latency: 2 of 3 turns.');
    expect(lines).toContain('It also used Token Burst once (its Default).');
  });

  it("says when the taught card never fired, and why: its condition never held", () => {
    const lines = summary([traceEv(1, 'default', [{ cardId: 'taught', reason: 'conditionFalse' }]), traceEv(2, 'default', [{ cardId: 'taught', reason: 'conditionFalse' }])], FINISHER);
    expect(lines[0]).toBe('Tokenibble kept using Token Burst: 2 of 2 turns (its Default).');
    expect(lines).toContain("Its card 'IF foe HP < 50% THEN Early Exit' never fired (no foe below 50% HP).");
  });

  it('says when it went offline', () => {
    const lines = summary([traceEv(1, 'taught'), hit(1, 1, 15, 0), { round: 1, type: 'Fainted', target: 1 }]);
    expect(lines).toContain('It went offline in round 1.');
  });

  it('is empty when no teammate acted from a deck', () => {
    expect(summary([hit(1, 0, 6, 14)])).toEqual([]);
  });

  it('reads a real lost fight: the bad card (Low Latency while healthy) against Bootcamp Grad', () => {
    const def = trainerBattle('blitzr', 'spinUp', 'tutorial.c', 0);
    const r = simulate(def.setup, def.seed, { kind: 'scripted', next: naiveCommand });
    expect(r.winner).toBe('b');
    const state = createBattle(def.setup, def.seed);
    const creatures = state.creatures.map((x) => ({ index: x.index, side: x.side === 'a' ? (0 as const) : (1 as const), isOrchestrator: x.isOrchestrator, hp: x.hp, maxHp: x.maxHp, name: x.speciesId === 'tokenibble' ? 'Tokenibble' : x.speciesId }));
    const lines = keptSummary({ events: r.events, creatures, deckOf: (i) => state.creatures[i]?.deck ?? null, moveName });
    expect(lines[0]).toMatch(/^Tokenibble kept using Low Latency: \d+ of \d+ turns/);
  });
});

describe('graftSummary: the graft path has no card, so the hint is about the grafted move', () => {
  it('counts how often you used the graft and gives one hint', () => {
    const events: BattleEvent[] = [
      { round: 1, type: 'MoveUsed', actor: 0, moveId: 'distilled-strike', target: 2 },
      { round: 2, type: 'MoveUsed', actor: 0, moveId: 'token-nibble', target: 2 },
      { round: 2, type: 'MoveUsed', actor: 2, moveId: 'token-nibble', target: 0 },
      { round: 3, type: 'MoveUsed', actor: 0, moveId: 'distilled-strike', target: 2 },
    ];
    const lines = graftSummary({ events, playerIndex: 0, graftMove: 'token-nibble', moveName });
    expect(lines[0]).toBe('You used Token Nibble once in 3 turns.');
    expect(lines[1]).toMatch(/Token Nibble/);
    expect(graftSummary({ events: [], playerIndex: 0, graftMove: 'token-nibble', moveName })[0]).toBe('You never used Token Nibble.');
  });
});
