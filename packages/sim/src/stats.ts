import type { MatchStats, Verdict } from './types.js';

const Z95 = 1.959964;

/** Side A's score rate: a draw counts as half a win (spec §9). */
export function winRate(s: MatchStats): number {
  const n = s.winsA + s.winsB + s.draws;
  return n === 0 ? 0 : (s.winsA + s.draws / 2) / n;
}

/** The 95% Wilson score interval for `wins` successes in `n` trials (`wins` may be fractional: draws are 0.5). */
export function wilson95(wins: number, n: number): [number, number] {
  if (n <= 0) return [0, 1];
  const p = wins / n;
  const z2 = Z95 * Z95;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Point estimate against a band, ignoring uncertainty: inside is a pass, outside a fail. */
export function pointVerdict(point: number, band: [number, number]): 'pass' | 'fail' {
  return point >= band[0] && point <= band[1] ? 'pass' : 'fail';
}

/**
 * Spec §9: pass when the point estimate and the whole interval lie inside the band; fail when the
 * point estimate is outside; inconclusive when the point is inside but the interval crosses an edge.
 */
export function verdict(point: number, interval: [number, number], band: [number, number]): Verdict {
  if (pointVerdict(point, band) === 'fail') return 'fail';
  return interval[0] >= band[0] && interval[1] <= band[1] ? 'pass' : 'inconclusive';
}
