import { describe, expect, it } from 'vitest';
import { parseSeed } from '../../src/rng/seed.js';

describe('parseSeed', () => {
  it('splits into four big-endian words', () => {
    expect(parseSeed('0123456789abcdef0123456789abcdef')).toEqual({
      ok: true,
      words: [0x01234567, 0x89abcdef, 0x01234567, 0x89abcdef],
    });
  });
  it('rejects wrong lengths', () => {
    expect(parseSeed('a'.repeat(31))).toEqual({ ok: false, error: 'length' });
    expect(parseSeed('a'.repeat(33))).toEqual({ ok: false, error: 'length' });
    expect(parseSeed('')).toEqual({ ok: false, error: 'length' });
  });
  it('rejects uppercase and non-hex', () => {
    expect(parseSeed('0123456789ABCDEF0123456789abcdef')).toEqual({ ok: false, error: 'charset' });
    expect(parseSeed('g'.repeat(32))).toEqual({ ok: false, error: 'charset' });
  });
  it('rejects all-zero', () => {
    expect(parseSeed('0'.repeat(32))).toEqual({ ok: false, error: 'allZero' });
  });
});
