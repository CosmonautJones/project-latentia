import {
  activeCardCount,
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
import { ALWAYS, HURT, layout } from '../src/archetypes/build.js';
import { HEADLINES, cardFires } from '../src/archetypes/headlines.js';
import { ARCHETYPES, mirrorOf, starterGrid } from '../src/archetypes/index.js';
import { runMatch, seedFor } from '../src/runner.js';

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

  it('puts every archetype creature at L8, v2 by the ladder (Ruling 128)', () => {
    for (const a of ARCHETYPES) {
      for (const c of members(a.side)) {
        expect(c.level, c.id).toBe(8);
        expect(c.version, c.id).toBe('v2');
        expect(c.level, c.id).toBeGreaterThanOrEqual(MIN_LEVEL[c.version]);
      }
    }
  });

  it('fields exactly 1 + 2 + 1 creatures per side, with two bound Subagent Slots (Ruling 130)', () => {
    for (const a of ARCHETYPES) {
      expect([a.side.active.length, a.side.bench.length], a.id).toEqual([2, 1]);
      const slots = a.side.grid?.pieces.filter((p) => p.kind === 'subagentSlot').map((p) => p.subagentId) ?? [];
      expect(new Set(slots), a.id).toEqual(new Set(a.side.active.map((c) => c.id)));
      expect(slots, a.id).toHaveLength(2);
    }
  });

  it('keeps every active deck within its slot active-card count, and every bench deck within the smaller one (Ruling 132)', () => {
    for (const a of ARCHETYPES) {
      const grid = a.side.grid!;
      const counts = a.side.active.map((c) => {
        const slot = grid.pieces.find((p) => p.kind === 'subagentSlot' && p.subagentId === c.id);
        const n = activeCardCount(grid, slot?.id ?? '', c.version);
        expect(c.deck?.cards.length ?? 0, `${c.id}: ${n} active`).toBeLessThanOrEqual(n);
        return n;
      });
      for (const c of a.side.bench) expect(c.deck?.cards.length ?? 0, `${c.id}: bench`).toBeLessThanOrEqual(Math.min(...counts));
    }
  });

  it('fires every headline card at least once across a pass over the field (Ruling 132)', () => {
    const fired = new Map<string, number>();
    ARCHETYPES.forEach((a, i) => {
      for (const b of ARCHETYPES) {
        if (a === b) continue;
        const r = simulate({ a: { ...a.side, opponentId: b.id }, b: { ...b.side, opponentId: a.id }, kind: 'trainer' }, seedFor(`headline:${b.id}`, i), { kind: 'autopilot' });
        for (const [creature, cards] of cardFires(r)) for (const [cardId, n] of cards) fired.set(`${creature}#${cardId}`, (fired.get(`${creature}#${cardId}`) ?? 0) + n);
      }
    });
    expect(Object.keys(HEADLINES).sort()).toEqual(ARCHETYPES.map((a) => a.id).sort());
    for (const [id, cards] of Object.entries(HEADLINES)) {
      expect(cards.length, id).toBeGreaterThan(0);
      for (const { creature, card } of cards) expect(fired.get(`${id}/${creature}#${card}`) ?? 0, `${id}/${creature} ${card}`).toBeGreaterThan(0);
    }
  });

  it('is deeply frozen and shares no object between archetypes (C4 cannot leak a mutation)', () => {
    const owner = new Map<object, string>();
    const walk = (v: unknown, id: string): void => {
      if (typeof v !== 'object' || v === null) return;
      expect(Object.isFrozen(v), id).toBe(true);
      const prev = owner.get(v);
      expect(prev === undefined || prev === id, `${id} shares an object with ${String(prev)}`).toBe(true);
      owner.set(v, id);
      for (const x of Object.values(v)) walk(x, id);
    };
    for (const a of ARCHETYPES) walk(a, a.id);
    for (const c of [ALWAYS, HURT]) expect(Object.isFrozen(c)).toBe(true);
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

describe('mirrorOf (Ruling 129)', () => {
  it('meets its archetype in a valid setup and a completed match, for every archetype', () => {
    for (const x of ARCHETYPES) {
      const m = mirrorOf(x, 'm');
      const r = validateSetup({ a: { ...x.side, opponentId: m.id }, b: { ...m.side, opponentId: x.id }, kind: 'trainer' });
      expect(r.errors, x.id).toEqual([]);
      const stats = runMatch(x, m, 2, `mirror:${x.id}`);
      expect(stats.winsA + stats.winsB + stats.draws, x.id).toBe(2);
    }
  });

  it('suffixes every creature id and slot binding, keeps the archetype id, and leaves the original untouched', () => {
    const x = ARCHETYPES[0]!;
    const before = structuredClone(x);
    const m = mirrorOf(x, 'm');
    expect(m.id).toBe(x.id);
    expect(members(m.side).map((c) => c.id)).toEqual(members(x.side).map((c) => `${c.id}~m`));
    const slots = (s: SideSetup) => s.grid?.pieces.flatMap((p) => (p.subagentId === undefined ? [] : [p.subagentId])) ?? [];
    expect(slots(m.side)).toEqual(slots(x.side).map((id) => `${id}~m`));
    expect(m.side.autopilot).toEqual(x.side.autopilot);
    expect(m.side.autopilot).not.toBe(x.side.autopilot);
    expect(x).toEqual(before);
  });

  it('is a deep copy: mutating its decks, grid, Autopilot and bench leaves the original unchanged', () => {
    for (const x of ARCHETYPES) {
      const before = structuredClone(x);
      const m = mirrorOf(x, 'm');
      const sub = m.side.active[0]!;
      sub.deck!.cards.push({ ...sub.deck!.default, id: 'extra' });
      (sub.deck!.default as { move: string }).move = 'compact';
      (m.side.grid!.pieces as unknown[]).pop();
      m.side.autopilot!.deck.cards.length = 0;
      m.side.autopilot!.temperature = 4;
      m.side.bench.length = 0;
      m.side.orchestrator.level = 1;
      expect(x, x.id).toEqual(before);
    }
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

  it('is deterministic and returns a fresh object on every call', () => {
    for (const s of STARTERS) {
      const g1 = starterGrid(s, 8, 'intern');
      const g2 = starterGrid(s, 8, 'intern');
      expect(g2).toEqual(g1);
      expect(g2).not.toBe(g1);
      expect(g2.pieces).not.toBe(g1.pieces);
      expect(g2.pieces[0]).not.toBe(g1.pieces[0]);
    }
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

  it("gives the mixed-starter archetypes their starter's three Skills on a two-slot grid", () => {
    for (const s of STARTERS) {
      const a = ARCHETYPES.find((x) => x.id === `mixed-starter-${s}`);
      expect(a, s).toBeDefined();
      const skills = a?.side.grid?.pieces.filter((p) => p.kind === 'skill').map((p) => p.moveId);
      expect(new Set(skills), s).toEqual(new Set(SPECIES[s].moves.filter((m) => m !== SPECIES[s].signature)));
    }
  });
});

describe('layout', () => {
  it('builds a legal grid from text and refuses a legend letter drawn as two separate blobs', () => {
    expect(validateGrid(layout(['PPP..', 'AAe..', 'AAe..', 'KK...', '.....'], { K: { skill: 'chain-of-thought' }, A: { slot: 'x' } }), 8).errors).toEqual([]);
    expect(() => layout(['PPPK.', 'AAe..', 'AAe..', 'K....', '.....'], { K: { skill: 'chain-of-thought' }, A: { slot: 'x' } })).toThrow(/not connected/);
  });
});
