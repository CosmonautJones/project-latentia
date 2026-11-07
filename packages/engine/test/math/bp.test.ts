import { describe, expect, it } from 'vitest';
import { EngineInvariantError, assertSafe, idiv, mulBp, stageBp, STAGE_BP } from '../../src/math/bp.js';

describe('bp', () => {
  it('idiv floors, including negatives', () => {
    expect(idiv(7, 2)).toBe(3);
    expect(idiv(-7, 2)).toBe(-4);
  });
  it('idiv rejects zero divisor and unsafe ints', () => {
    expect(() => idiv(1, 0)).toThrow(EngineInvariantError);
    expect(() => idiv(1.5, 2)).toThrow(EngineInvariantError);
    expect(() => idiv(Number.MAX_SAFE_INTEGER + 1, 2)).toThrow(EngineInvariantError);
  });
  it('mulBp floors x*bp/10000', () => {
    expect(mulBp(100, 12500)).toBe(125);
    expect(mulBp(7, 5000)).toBe(3);
  });
  it('mulBp throws when the product is unsafe', () => {
    expect(() => mulBp(Number.MAX_SAFE_INTEGER, 20000)).toThrow(EngineInvariantError);
  });
  it('assertSafe passes safe ints and throws otherwise', () => {
    expect(assertSafe(5, 'x')).toBe(5);
    expect(() => assertSafe(NaN, 'x')).toThrow(/x/);
  });
  it('stageBp clamps to -3..3', () => {
    expect(STAGE_BP).toEqual([5714, 6667, 8000, 10000, 12500, 15000, 17500]);
    expect(stageBp(0)).toBe(10000);
    expect(stageBp(-9)).toBe(5714);
    expect(stageBp(9)).toBe(17500);
  });
  it('EngineInvariantError carries context', () => {
    const e = new EngineInvariantError('boom', { round: 3, actor: 1, seed: 'ab' });
    expect(e).toBeInstanceOf(Error);
    expect([e.round, e.actor, e.seed]).toEqual([3, 1, 'ab']);
  });
});
