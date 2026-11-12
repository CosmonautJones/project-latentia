import { moveDef, SPECIES } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { moveSentence, moveWords } from '../../src/battle/move-words.js';
import { GRAFT_MOVE } from '../../src/content/grids.js';

// Plain-word move details (ruling V14) for every move a v0.1 battle can show: the five species' moves, the
// universals and the graft. No stat jargon; the cost always; and short enough for one line of the narrowest band.

const V0_SPECIES = ['sagelet', 'blitzr', 'forkling', 'tokenibble', 'vibrat'] as const;
const UNIVERSALS = ['compact', 'clear', 'guardrail'];
const V0_MOVES = [...new Set([...V0_SPECIES.flatMap((s) => SPECIES[s].moves), ...UNIVERSALS, GRAFT_MOVE])];
/** The landscape band's text line at 426x240: the 281 px safe strip, 6 px a character, less the frame. */
const ONE_LINE = 44;

const def = (id: string) => {
  const d = moveDef(id);
  if (d === null) throw new Error(`no move ${id}`);
  return d;
};

describe('moveWords: every v0.1 move in plain words', () => {
  it('covers all 21 of them', () => expect(V0_MOVES.length).toBe(21));

  it.each(V0_MOVES)('%s: says what it does and what it costs, with no stat jargon, in two lines at most', (id) => {
    const words = moveWords(def(id));
    const text = words.join(' ');
    expect(words.length).toBeGreaterThanOrEqual(2);
    expect(text).toMatch(/Costs \d+\.|Free\./);
    expect(text).not.toMatch(/PWR|ACC|\bbp\b/);
    expect([...text].length).toBeLessThanOrEqual(ONE_LINE * 2);
  });

  it('reads like the ruling: "Hits hard. Costs 3. Never misses."', () => {
    expect(moveSentence(def('happy-to-help'))).toBe('Hits hard. Costs 3. Never misses.');
    expect(moveSentence(def('guardrail'))).toBe('Guards this turn: takes half damage, blocks non-attacks. Goes first. Costs 1.');
    expect(moveSentence(def('token-burst'))).toBe('Hits lightly. Goes first. Costs 1. Never misses.');
    expect(moveSentence(def('compact'))).toBe('Frees up context. Clears 1 Drift. Goes last. Free.');
    expect(moveSentence(def('low-latency'))).toBe('Raises its Speed a lot. Costs 1.');
    expect(moveSentence(def('accept-all'))).toBe('Hits very hard. Leaves junk in its own context. Costs 3. Rarely misses.');
  });

  it('uses the cost the move has now when given (Token Nibble makes the next move cost 1 more)', () => {
    expect(moveSentence(def('happy-to-help'), 4)).toBe('Hits hard. Costs 4. Never misses.');
  });
});
