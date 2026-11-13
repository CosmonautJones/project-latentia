import { describe, expect, it } from 'vitest';
import { battleResult } from '../../src/battle/result.js';
import { rivalBattle, trainerBattle, wildBattle } from '../../src/content/battles.js';
import type { FightReport } from '../../src/flow/telemetry.js';

const fight = (outcome: FightReport['outcome']): FightReport => ({ battle: 'trainer', outcome, rounds: 4, moves: 9, cardsFired: 4, cardId: 'tutorial.a', kept: ['Tokenibble kept using Token Burst: 4 of 4 turns (its Default).'] });

describe('battleResult', () => {
  it('a win reports battleWon with the fight and the win line', () => {
    const def = rivalBattle('sagelet', 0);
    expect(battleResult(def, 'win', fight('win'))).toEqual({ event: { type: 'battleWon', fight: fight('win') }, text: def.win });
  });

  it('a loss reports battleLost with the fight and the lose line; the debrief (not this line) says what Tokenibble kept doing', () => {
    for (const def of [rivalBattle('blitzr', 0), wildBattle('forkling', 0), trainerBattle('sagelet', 'spinUp', 'tutorial.a', 0)]) {
      const r = battleResult(def, 'lose', fight('lose'));
      expect(r.event).toEqual({ type: 'battleLost', fight: fight('lose') });
      expect(r.text).toBe(def.lose);
    }
  });

  it('a draw at the round cap counts as a loss', () => {
    const r = battleResult(rivalBattle('sagelet', 0), 'draw', fight('draw'));
    expect(r.event.type).toBe('battleLost');
    expect(r.text).toMatch(/draw/i);
  });
});
