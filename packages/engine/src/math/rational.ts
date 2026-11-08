import { assertSafe, EngineInvariantError, idiv } from './bp.js';

// Exact non-negative rationals as integer [numerator, denominator] pairs (spec §5 "Generalization": G is computed
// as an exact rational with integers). No floating point: only the integer helpers of bp.ts.

/** The greatest common divisor of two non-negative safe integers; gcd(n, 0) = n. */
export function gcd(a: number, b: number): number {
  let x = assertSafe(a, 'gcd a');
  let y = assertSafe(b, 'gcd b');
  if (x < 0 || y < 0) throw new EngineInvariantError(`gcd of a negative number: ${x}, ${y}`);
  while (y !== 0) {
    const r = x % y;
    x = y;
    y = r;
  }
  return x;
}

/** n ÷ d in lowest terms with a positive denominator; zero is [0, 1]. n ≥ 0 and d > 0, both safe integers. */
export function ratio(n: number, d: number): [number, number] {
  assertSafe(n, 'ratio numerator');
  assertSafe(d, 'ratio denominator');
  if (n < 0 || d <= 0) throw new EngineInvariantError(`ratio ${n}/${d} needs n ≥ 0 and d > 0`);
  const g = gcd(n, d);
  return n === 0 ? [0, 1] : [idiv(n, g), idiv(d, g)];
}

/** n ÷ d rounded to the nearest integer, an exact half rounding up: floor((2n + d) ÷ 2d). n ≥ 0, d > 0. */
export function roundHalfUp(n: number, d: number): number {
  assertSafe(n, 'roundHalfUp numerator');
  assertSafe(d, 'roundHalfUp denominator');
  if (n < 0 || d <= 0) throw new EngineInvariantError(`roundHalfUp ${n}/${d} needs n ≥ 0 and d > 0`);
  return idiv(assertSafe(2 * n + d, 'roundHalfUp 2n + d'), assertSafe(2 * d, 'roundHalfUp 2d'));
}
