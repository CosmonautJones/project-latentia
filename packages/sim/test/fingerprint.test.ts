import { fnv1a64Hex } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from '../src/archetypes/index.js';
import { canonicalJson, contentFingerprint } from '../src/fingerprint.js';
import { targetSetups } from '../src/target-setups.js';
import { TARGETS } from '../src/targets.js';

// The reports' content fingerprint (Ruling 143 I5).

describe('canonicalJson', () => {
  it('sorts keys at every depth, drops undefined members and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: undefined, x: 'q' }], c: null } })).toBe('{"a":{"c":null,"d":[3,{"x":"q","z":1}]},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
    expect(canonicalJson([2, 1, undefined])).toBe('[2,1,null]');
    expect(canonicalJson({ band: [0.45, 0.55] })).toBe('{"band":[0.45,0.55]}');
  });
});

describe('contentFingerprint', () => {
  it('is FNV-1a 64 of the canonical JSON of ARCHETYPES, TARGETS and every target setup', () => {
    const want = fnv1a64Hex(new TextEncoder().encode(canonicalJson({ archetypes: ARCHETYPES, targets: TARGETS, setups: targetSetups() })));
    expect(contentFingerprint()).toBe(want);
    expect(contentFingerprint()).toMatch(/^[0-9a-f]{16}$/);
  });
  it('covers every setup: the triangle, solo, graft and temperature setups are all in it', () => {
    expect(Object.keys(targetSetups()).sort()).toEqual(['graft', 'solo', 'starters', 'temperature', 'triangle']);
    expect((targetSetups().temperature as unknown[]).length).toBe(ARCHETYPES.length);
  });
  it('changes when any archetype detail changes', () => {
    const bundle = { archetypes: ARCHETYPES, targets: TARGETS, setups: targetSetups() };
    const tweaked = structuredClone(bundle) as typeof bundle & { archetypes: { side: { orchestrator: { level: number } } }[] };
    (tweaked.archetypes[0] as { side: { orchestrator: { level: number } } }).side.orchestrator.level += 1;
    expect(canonicalJson(tweaked)).not.toBe(canonicalJson(bundle));
  });
});
