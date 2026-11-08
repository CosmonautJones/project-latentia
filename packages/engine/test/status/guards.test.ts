import { describe, expect, it } from 'vitest';
import { lo } from '../../src/rng/draws.js';
import { GUARD_THRESHOLDS_729, guardSucceeds } from '../../src/status/guards.js';

describe('guardSucceeds', () => {
  it('thresholds are fixed', () => {
    expect([...GUARD_THRESHOLDS_729]).toEqual([729, 243, 81, 27, 9, 3]);
  });
  it('first use always succeeds', () => {
    for (const d of [0, 1, 728, 729, 0xffffffff]) expect(guardSucceeds(0, d)).toBe(true);
  });
  it('each k succeeds iff lo(d, 729) < threshold', () => {
    for (let k = 0; k < 6; k++) {
      const t = GUARD_THRESHOLDS_729[k] as number;
      for (const d of [0, t - 1, t, 728, 0x12345678, 0xffffffff]) {
        expect(guardSucceeds(k, d)).toBe(lo(d, 729) < t);
      }
    }
    expect(guardSucceeds(1, 242)).toBe(true);
    expect(guardSucceeds(1, 243)).toBe(false);
  });
  it('k >= 6 always fails', () => {
    expect(guardSucceeds(6, 0)).toBe(false);
    expect(guardSucceeds(7, 0)).toBe(false);
  });
});
