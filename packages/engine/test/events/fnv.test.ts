import { describe, expect, it } from 'vitest';
import { fnv1a64Hex } from '../../src/events/fnv';
import { eventStreamHash } from '../../src/events/canonical';
import type { BattleEvent } from '../../src/events/types';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('fnv1a64Hex', () => {
  it('matches known-answer vectors', () => {
    expect(fnv1a64Hex(enc(''))).toBe('cbf29ce484222325');
    expect(fnv1a64Hex(enc('a'))).toBe('af63dc4c8601ec8c');
    expect(fnv1a64Hex(enc('{"a":1,"b":[2,3]}'))).toBe('55bed68470220de4');
  });

  it('hashes UTF-8 bytes, not UTF-16 units', () => {
    expect(fnv1a64Hex(enc('é'))).not.toBe(fnv1a64Hex(new Uint8Array([0xe9])));
    expect(fnv1a64Hex(enc('é'))).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('eventStreamHash', () => {
  const a = { type: 'RoundStart', round: 1 } as BattleEvent;
  it('is the fnv of the canonical json', () => {
    expect(eventStreamHash([a])).toBe(fnv1a64Hex(enc('[{"round":1,"type":"RoundStart"}]')));
  });
  it('ignores key order', () => {
    const b = { round: 1, type: 'RoundStart' } as BattleEvent;
    expect(eventStreamHash([a])).toBe(eventStreamHash([b]));
  });
  it('is sensitive to content and order', () => {
    const c = { type: 'RoundEnd', round: 1 } as BattleEvent;
    expect(eventStreamHash([a, c])).not.toBe(eventStreamHash([c, a]));
  });
});
