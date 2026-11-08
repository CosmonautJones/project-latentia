import {
  MAX_DECK_CARDS,
  SPECIES,
  SPECIES_IDS,
  TYPES,
  bandFor,
  simulate,
  validateGrid,
  validateSetup,
  type CreatureSetup,
  type SideSetup,
  type Version,
} from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { ARCHETYPES, starterGrid } from '../src/archetypes/index.js';
import { seedFor } from '../src/runner.js';

// Task C2 (spec §9): twenty archetype teams as data, under Rulings 120–124.

/** The bible's Autopilot ladder (Ruling 121): an orchestrator's deck holds exactly this many cards besides Default. */
const AUTOPILOT_SIZE: Record<Version, number> = { v1: 6, v2: 8, 'v3.5': 10, v4: 12 };
/** The bible's evolution levels: v2 at L6, v3.5 Turbo at L12 (v4 is post-demo). */
const MIN_LEVEL: Record<Version, number> = { v1: 1, v2: 6, 'v3.5': 12, v4: 20 };

const members = (s: SideSetup): CreatureSetup[] => [s.orchestrator, ...s.active, ...s.bench];
const subagents = (s: SideSetup): CreatureSetup[] => [...s.active, ...s.bench];
const speciesDef = (id: string) => SPECIES[id as keyof typeof SPECIES];
const STARTERS = ['sagelet', 'blitzr', 'forkling'] as const;

type Cells = readonly (readonly [number, number])[];
/** A shape's cells as a sorted key, moved so its minimum x and y are 0. */
const cellKey = (cells: Cells): string => {
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => `${x - mx},${y - my}`).sort().join(';');
};
/** The keys of a shape's four quarter turns. */
const turns = (shape: Cells): string[] => {
  const out: string[] = [];
  let t: Cells = shape;
  for (let i = 0; i < 4; i++) {
    out.push(cellKey(t));
    t = t.map(([x, y]) => [-y, x] as const);
  }
  return out;
};

describe('ARCHETYPES', () => {
  it('holds 20 archetypes with unique ids', () => {
    expect(ARCHETYPES).toHaveLength(20);
    expect(new Set(ARCHETYPES.map((a) => a.id)).size).toBe(20);
    for (const a of ARCHETYPES) expect(a.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('passes validateSetup for every ordered pairing (creature ids are unique across archetypes)', () => {
    for (const a of ARCHETYPES) {
      for (const b of ARCHETYPES) {
        if (a === b) continue;
        const r = validateSetup({ a: { ...a.side, opponentId: b.id }, b: { ...b.side, opponentId: a.id }, kind: 'trainer' });
        expect(r.errors, `${a.id} vs ${b.id}`).toEqual([]);
      }
    }
  });

  it('gives every side a grid that passes validateGrid at its orchestrator level', () => {
    for (const a of ARCHETYPES) {
      expect(a.side.grid, a.id).not.toBeNull();
      expect(validateGrid(a.side.grid, a.side.orchestrator.level).errors, a.id).toEqual([]);
    }
  });

  it('puts every side on an Autopilot deck of exactly its orchestrator version size (Ruling 121)', () => {
    for (const a of ARCHETYPES) {
      const auto = a.side.autopilot;
      expect(auto, a.id).toBeDefined();
      expect(auto?.deck.cards.length, a.id).toBe(AUTOPILOT_SIZE[a.side.orchestrator.version]);
      // Ruling 123: Specialist is subagent-only, so an Autopilot card carries no recordedFrom.
      for (const c of auto?.deck.cards ?? []) expect(c.recordedFrom, `${a.id} ${c.id}`).toBeUndefined();
    }
  });

  it('uses slice levels (L5–L10) and versions the level allows, v1 or v2 only', () => {
    for (const a of ARCHETYPES) {
      for (const c of members(a.side)) {
        expect(c.level, c.id).toBeGreaterThanOrEqual(5);
        expect(c.level, c.id).toBeLessThanOrEqual(10);
        expect(['v1', 'v2'], c.id).toContain(c.version);
        expect(c.level, c.id).toBeGreaterThanOrEqual(MIN_LEVEL[c.version]);
      }
    }
  });

  it('gives every subagent a deck within MAX_DECK_CARDS, a generalization and a trained temperature', () => {
    for (const a of ARCHETYPES) {
      for (const c of subagents(a.side)) {
        expect(c.deck, c.id).toBeDefined();
        expect(c.deck?.cards.length ?? 0, c.id).toBeLessThanOrEqual(MAX_DECK_CARDS);
        expect(c.generalization, c.id).toBeDefined();
        expect(c.trainedTemperature, c.id).toBeDefined();
      }
    }
  });

  it('spreads subagents across all three generalization bands and every trained temperature', () => {
    const all = ARCHETYPES.flatMap((a) => subagents(a.side));
    expect(new Set(all.map((c) => bandFor(c.generalization ?? 50)))).toEqual(new Set(['robust', 'stable', 'brittle']));
    expect(new Set(all.map((c) => c.trainedTemperature))).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it('spreads Autopilot temperatures over T0–T4', () => {
    expect(new Set(ARCHETYPES.map((a) => a.side.autopilot?.temperature))).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it('uses only slice species, and each of the 17 at least once', () => {
    const used = new Set(ARCHETYPES.flatMap((a) => members(a.side).map((c) => c.species)));
    for (const s of used) expect(SPECIES_IDS, s).toContain(s);
    expect(used.size).toBe(17);
  });

  it('shows every type among team members in at least 2 archetypes', () => {
    for (const t of TYPES) {
      const n = ARCHETYPES.filter((a) => members(a.side).some((c) => speciesDef(c.species)?.types.includes(t))).length;
      expect(n, t).toBeGreaterThanOrEqual(2);
    }
  });

  it('exercises Skill, Tool, Cache, graft, Subagent Slot and Example Card pieces', () => {
    const kinds = new Set(ARCHETYPES.flatMap((a) => a.side.grid?.pieces.map((p) => p.kind) ?? []));
    expect(kinds).toEqual(new Set(['systemPrompt', 'skill', 'tool', 'cache', 'graft', 'subagentSlot', 'exampleCard']));
  });

  it('draws each graft piece in its source species graft shape', () => {
    for (const a of ARCHETYPES) {
      for (const p of a.side.grid?.pieces ?? []) {
        if (p.kind !== 'graft') continue;
        const source = Object.values(SPECIES).find((s) => s.signature === p.moveId);
        expect(source, `${a.id} ${p.id}`).toBeDefined();
        expect(turns(source?.graftShape ?? []), `${a.id} ${p.id}`).toContain(cellKey(p.shape));
      }
    }
  });

  it('names an archetype id in every recordedFrom and recordedFoes entry', () => {
    const ids = new Set(ARCHETYPES.map((a) => a.id));
    for (const a of ARCHETYPES) {
      for (const c of subagents(a.side)) {
        for (const f of c.recordedFoes ?? []) expect(ids, `${c.id} recordedFoes`).toContain(f);
        for (const k of c.deck?.cards ?? []) if (k.recordedFrom !== undefined) expect(ids, `${c.id} ${k.id}`).toContain(k.recordedFrom);
      }
    }
  });

  it('runs every archetype on both sides of a battle without throwing', () => {
    ARCHETYPES.forEach((a, i) => {
      const b = ARCHETYPES[(i + 1) % ARCHETYPES.length]!;
      for (const [x, y] of [[a, b], [b, a]] as const) {
        const r = simulate({ a: { ...x.side, opponentId: y.id }, b: { ...y.side, opponentId: x.id }, kind: 'trainer' }, seedFor('archetypes', i), { kind: 'autopilot' });
        expect(r.rounds, `${x.id} vs ${y.id}`).toBeGreaterThan(0);
      }
    });
  });
});

describe('starterGrid (Ruling 124)', () => {
  const tokenibble = (id: string, level: number): CreatureSetup => ({ id, species: 'tokenibble', level, version: 'v2', moves: [...SPECIES.tokenibble.moves] });
  const starterSide = (species: string, level: number, tag: string): SideSetup => ({
    orchestrator: { id: `${tag}-${species}`, species, level, version: 'v2', moves: [] },
    active: [tokenibble(`${tag}-intern`, level)],
    bench: [],
    grid: starterGrid(species as (typeof STARTERS)[number], level, `${tag}-intern`),
    opponentId: 'field',
  });

  it.each(STARTERS)('%s: the L8 grid passes validateGrid, and validateSetup with Tokenibble L8 as its subagent', (s) => {
    const grid = starterGrid(s, 8, 'intern');
    expect(validateGrid(grid, 8).errors).toEqual([]);
    expect(grid.pieces.filter((p) => p.kind === 'subagentSlot').map((p) => p.subagentId)).toEqual(['intern']);
    const mirror = { a: starterSide(s, 8, 'a'), b: starterSide(s, 8, 'b'), kind: 'trainer' as const };
    expect(validateSetup(mirror).errors).toEqual([]);
  });

  it('grants each starter its three non-signature moves as Skills', () => {
    for (const s of STARTERS) {
      const skills = starterGrid(s, 8, 'intern').pieces.filter((p) => p.kind === 'skill').map((p) => p.moveId);
      expect(new Set(skills), s).toEqual(new Set(SPECIES[s].moves.filter((m) => m !== SPECIES[s].signature)));
    }
  });

  it('sizes the grid by level from L7 (5×5, 6×5, 6×6) and refuses levels whose grid cannot hold it', () => {
    for (const level of [7, 9, 10, 12, 13, 20]) {
      for (const s of STARTERS) expect(validateGrid(starterGrid(s, level, 'intern'), level).errors, `${s} L${level}`).toEqual([]);
    }
    expect(() => starterGrid('sagelet', 6, 'intern')).toThrow(RangeError);
  });

  it('uses the starter grid in the three mixed-starter archetypes', () => {
    for (const s of STARTERS) {
      const a = ARCHETYPES.find((x) => x.id === `mixed-starter-${s}`);
      expect(a, s).toBeDefined();
      const intern = a?.side.active[0]?.id ?? '';
      expect(a?.side.grid).toEqual(starterGrid(s, a?.side.orchestrator.level ?? 0, intern));
    }
  });
});
