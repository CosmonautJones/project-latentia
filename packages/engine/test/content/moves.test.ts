import { describe, expect, it } from 'vitest';
import { MOVES, moveDef } from '../../src/content/moves.js';

describe('moveDef', () => {
  it('returns the move for a move id', () => {
    expect(moveDef('ship-it')).toBe(MOVES['ship-it']);
  });

  it('returns null for lever names, unknown ids and prototype keys', () => {
    for (const id of ['swap', 'none', 'no-such-move', 'toString', '__proto__']) expect(moveDef(id)).toBeNull();
  });
});
