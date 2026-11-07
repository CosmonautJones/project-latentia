import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/events/canonical';

describe('canonicalJson', () => {
  it('sorts keys and drops whitespace', () => {
    expect(canonicalJson({ b: [2, 3], a: 1 })).toBe('{"a":1,"b":[2,3]}');
  });
  it('sorts by UTF-16 code unit', () => {
    expect(canonicalJson({ a: 1, B: 2 })).toBe('{"B":2,"a":1}');
  });
  it('sorts nested objects', () => {
    expect(canonicalJson([{ z: { y: 1, x: 2 } }])).toBe('[{"z":{"x":2,"y":1}}]');
  });
  it('serialises primitives', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(true)).toBe('true');
    expect(canonicalJson('a"b\n')).toBe('"a\\"b\\n"');
    expect(canonicalJson(-5)).toBe('-5');
    expect(canonicalJson(0)).toBe('0');
  });
  it('rejects unsupported values', () => {
    expect(() => canonicalJson(1.5)).toThrow(TypeError);
    expect(() => canonicalJson(NaN)).toThrow(TypeError);
    expect(() => canonicalJson(Infinity)).toThrow(TypeError);
    expect(() => canonicalJson(undefined)).toThrow(TypeError);
    expect(() => canonicalJson({ a: undefined })).toThrow(TypeError);
    expect(() => canonicalJson([() => 1])).toThrow(TypeError);
    expect(() => canonicalJson(new Map())).toThrow(TypeError);
    expect(() => canonicalJson(new Set())).toThrow(TypeError);
    expect(() => canonicalJson(Symbol('x'))).toThrow(TypeError);
    expect(() => canonicalJson(10n)).toThrow(TypeError);
  });
  it('rejects unsafe integers', () => {
    expect(() => canonicalJson(2 ** 53)).toThrow(TypeError);
  });
});
