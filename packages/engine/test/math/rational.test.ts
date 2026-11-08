import { describe, expect, it } from 'vitest';
import { EngineInvariantError } from '../../src/math/bp.js';
import { gcd, ratio, roundHalfUp } from '../../src/math/rational.js';

describe('gcd', () => {
  it('is the greatest common divisor of two non-negative safe integers; gcd(n, 0) is n', () => {
    expect(gcd(12, 9)).toBe(3);
    expect(gcd(9, 12)).toBe(3);
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(7, 0)).toBe(7);
    expect(gcd(17, 5)).toBe(1);
  });
});

describe('ratio: an exact rational in lowest terms', () => {
  it('reduces by the gcd and keeps the denominator positive', () => {
    expect(ratio(9, 12)).toEqual([3, 4]);
    expect(ratio(6, 6)).toEqual([1, 1]);
    expect(ratio(1, 6)).toEqual([1, 6]);
    expect(ratio(3, 6)).toEqual([1, 2]);
  });

  it('writes zero as [0, 1]', () => {
    expect(ratio(0, 6)).toEqual([0, 1]);
    expect(ratio(0, 1)).toEqual([0, 1]);
  });

  it('rejects a zero or negative denominator, a negative numerator and non-integers', () => {
    expect(() => ratio(1, 0)).toThrow(EngineInvariantError);
    expect(() => ratio(1, -2)).toThrow(EngineInvariantError);
    expect(() => ratio(-1, 2)).toThrow(EngineInvariantError);
    expect(() => ratio(1.5, 2)).toThrow(EngineInvariantError);
  });
});

describe('roundHalfUp(n, d): n ÷ d rounded to the nearest integer, halves up', () => {
  it('rounds halves up, never to even', () => {
    expect(roundHalfUp(5, 2)).toBe(3); // 2.5
    expect(roundHalfUp(7, 2)).toBe(4); // 3.5
    expect(roundHalfUp(145, 2)).toBe(73); // 72.5 (banker's rounding would give 72)
    expect(roundHalfUp(135, 2)).toBe(68); // 67.5
  });

  it('rounds below a half down and above a half up; exact quotients are unchanged', () => {
    expect(roundHalfUp(1, 3)).toBe(0);
    expect(roundHalfUp(2, 3)).toBe(1);
    expect(roundHalfUp(230, 3)).toBe(77); // 76.67
    expect(roundHalfUp(4, 2)).toBe(2);
    expect(roundHalfUp(0, 7)).toBe(0);
  });

  it('rejects a negative numerator and a zero or negative denominator', () => {
    expect(() => roundHalfUp(-1, 2)).toThrow(EngineInvariantError);
    expect(() => roundHalfUp(1, 0)).toThrow(EngineInvariantError);
    expect(() => roundHalfUp(1, -2)).toThrow(EngineInvariantError);
  });
});
