import { describe, expect, it } from 'vitest';
import { battleResult } from '../../src/battle/result.js';
import { rivalBattle, trainerBattle, wildBattle } from '../../src/content/battles.js';

const SUMMARY = ["Tokenibble: 'IF foe HP >= 50% THEN Token Nibble' x4."];

describe('battleResult', () => {
  it('a win reports battleWon with the win line', () => {
    const def = rivalBattle('sagelet', 0);
    expect(battleResult(def, 'win', SUMMARY)).toEqual({ event: { type: 'battleWon' }, text: def.win });
  });

  it('losing the rival or the wild battle reports battleLost (the flow restarts it), without a card summary', () => {
    for (const def of [rivalBattle('blitzr', 0), wildBattle('forkling', 0)]) {
      const r = battleResult(def, 'lose', SUMMARY);
      expect(r.event).toEqual({ type: 'battleLost' });
      expect(r.text).toBe(def.lose);
    }
  });

  it('losing to the trainer carries what the subagent kept doing', () => {
    const def = trainerBattle('sagelet', 'spinUp', 'tutorial.a', 0);
    const r = battleResult(def, 'lose', SUMMARY);
    expect(r.event).toEqual({ type: 'battleLost' });
    expect(r.text).toBe(`${def.lose} What your team kept doing: ${SUMMARY[0]}`);
    // No deck-driven teammate (the graft path): just the line.
    expect(battleResult(def, 'lose', []).text).toBe(def.lose);
  });

  it('a draw at the round cap counts as a loss, so the fight restarts', () => {
    const r = battleResult(rivalBattle('sagelet', 0), 'draw', []);
    expect(r.event).toEqual({ type: 'battleLost' });
    expect(r.text).toMatch(/draw/i);
  });
});
