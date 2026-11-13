import { describe, expect, it } from 'vitest';
import { DISCLOSURE, disclosureFor } from '../../src/battle/disclosure.js';

// Ruling V14: each fight shows only what has been taught so far; V12: the dial waits for `unlocks.temperature`.
describe('per-fight disclosure', () => {
  it('Kip and the wild Tokenibble: HP, moves, context pips and the foe telegraph; no teammate line, no dial', () => {
    for (const id of ['rival', 'wild'] as const) {
      expect(DISCLOSURE[id]).toEqual({ hp: true, moves: true, contextPips: true, foeTelegraph: true, teammateTelegraph: false, temperature: false });
    }
  });

  it("the Bootcamp Grad adds the teammate's telegraph", () => {
    expect(DISCLOSURE.trainer).toEqual({ hp: true, moves: true, contextPips: true, foeTelegraph: true, teammateTelegraph: true, temperature: false });
  });

  it('the dial shows in any fight only once the save unlocks temperature', () => {
    for (const id of ['rival', 'wild', 'trainer'] as const) {
      expect(disclosureFor(id, { temperature: false }).temperature).toBe(false);
      expect(disclosureFor(id, { temperature: true })).toEqual({ ...DISCLOSURE[id], temperature: true });
    }
  });
});
