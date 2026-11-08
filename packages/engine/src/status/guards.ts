import { lo } from '../rng/draws.js';

/** Success threshold out of 729 by consecutive prior guard uses k: 1/1, 1/3, 1/9, 1/27, 1/81, 1/243. */
export const GUARD_THRESHOLDS_729 = [729, 243, 81, 27, 9, 3] as const;

/** `consecutive` = guard uses immediately before this one; k >= 6 always fails. */
export function guardSucceeds(consecutive: number, d3: number): boolean {
  const threshold = GUARD_THRESHOLDS_729[consecutive];
  return threshold !== undefined && lo(d3, 729) < threshold;
}
