import { SPECIES, type CreatureSetup, type SideSetup } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { runMatch, seedFor } from '../src/runner.js';
import type { Archetype } from '../src/types.js';

const mon = (id: string, species: string): CreatureSetup => ({
  id,
  species,
  level: 5,
  version: 'v1',
  moves: [...(SPECIES[species as keyof typeof SPECIES]?.moves ?? [])],
});

const side = (tag: string, active: string[]): SideSetup => ({
  orchestrator: mon(`${tag}-orch`, 'sagelet'),
  active: active.map((s, i) => mon(`${tag}-act${i}`, s)),
  bench: [],
  grid: null,
  opponentId: tag === 'a' ? 'b' : 'a',
});

const arche = (id: string, tag: string, active: string[]): Archetype => ({ id, side: side(tag, active) });

describe('seedFor', () => {
  it('is deterministic and 32 lowercase hex characters', () => {
    expect(seedFor('x', 7)).toBe(seedFor('x', 7));
    expect(seedFor('x', 7)).toMatch(/^[0-9a-f]{32}$/);
    expect(seedFor('x', 7)).not.toBe(seedFor('x', 8));
    expect(seedFor('x', 7)).not.toBe(seedFor('y', 7));
  });
  it('is unique across 10,000 labels and never all zero', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(seedFor(`label-${i}`, 0));
    expect(seen.size).toBe(10_000);
    expect(seen.has('0'.repeat(32))).toBe(false);
  });
});

describe('runMatch', () => {
  const a = arche('a', 'a', ['blitzr', 'forkling']);
  const b = arche('b', 'b', ['tokenibble', 'agentoad']);

  it('totals equal the seed count and rounds has one entry per battle', () => {
    const s = runMatch(a, b, 40, 'totals');
    expect(s.winsA + s.winsB + s.draws).toBe(40);
    expect(s.rounds).toHaveLength(40);
    expect(s.rounds.every((r) => r >= 1 && r <= 50)).toBe(true);
  });
  it('is deterministic for a given label and varies with it', () => {
    expect(runMatch(a, b, 30, 'same')).toEqual(runMatch(a, b, 30, 'same'));
    expect(runMatch(a, b, 30, 'same').rounds).not.toEqual(runMatch(a, b, 30, 'other').rounds);
  });
  it('a mirror match is not lopsided and zero seeds gives empty stats', () => {
    const m = runMatch(a, { id: 'a2', side: side('b', ['blitzr', 'forkling']) }, 200, 'mirror');
    expect(Math.abs(m.winsA - m.winsB)).toBeLessThan(60);
    expect(runMatch(a, b, 0, 'none')).toEqual({ winsA: 0, winsB: 0, draws: 0, rounds: [] });
  });
});
