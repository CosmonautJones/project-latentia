import { activeCardCount, createBattle, simulate, SPECIES, SPECIES_IDS, typeMultiplierBp, validateGrid, validateSetup, type BattleResult, type Card, type GridLayout, type SideSetup, type TypeId } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { cardFires } from '../src/archetypes/headlines.js';
import { ARCHETYPES, mirrorOf, starterGrid } from '../src/archetypes/index.js';
import { seedFor } from '../src/runner.js';
import { GRAFT_SPECIES, GRAFT_STARTER, graftVariant, rolesOf, spinUpVariant, starterSide, temperatureSides, TRIANGLE } from '../src/target-setups.js';
import type { Archetype } from '../src/types.js';

// The balance targets' setups (Rulings 133–134): their structure, and for each target a "setup is live" check that its
// defining difference actually happens in battle.

const STARTERS = ['sagelet', 'blitzr', 'forkling'] as const;
const setupOf = (a: Archetype, b: Archetype) => ({ a: { ...a.side, opponentId: b.id }, b: { ...b.side, opponentId: a.id }, kind: 'trainer' as const });
const valid = (a: Archetype, b: Archetype) => validateSetup(setupOf(a, b)).errors;
const battle = (a: Archetype, b: Archetype, label: string, i: number): BattleResult => simulate(setupOf(a, b), seedFor(label, i), { kind: 'autopilot' });
/** `n` battles with `x` on side a, then `n` with it on side b. */
const both = (x: Archetype, y: Archetype, label: string, n: number): BattleResult[] =>
  Array.from({ length: n }, (_, i) => [battle(x, y, `${label}:ab`, i), battle(y, x, `${label}:ba`, i)]).flat();
const members = (s: SideSetup) => [s.orchestrator, ...s.active, ...s.bench];
/** Canonical indices of a side's creatures in a battle (spec §5: side a's roster, then side b's). */
const indicesOf = (r: BattleResult, a: Archetype): number[] => {
  const ids = [...members(r.log.setup.a), ...members(r.log.setup.b)].map((c) => c.id);
  const mine = new Set(members(a.side).map((c) => c.id));
  return ids.flatMap((id, i) => (mine.has(id) ? [i] : []));
};
/** How often creature `id`'s card `card` fired over the battles. */
const fired = (rs: readonly BattleResult[], id: string, card: string): number => rs.reduce((n, r) => n + (cardFires(r).get(id)?.get(card) ?? 0), 0);
const autopilotCards = (s: SideSetup): Card[] => {
  const d = s.autopilot?.deck;
  if (d === undefined) throw new Error('no autopilot');
  return [...d.cards, d.default];
};
/** A card without its move and target: the template's shape. */
const shapeOf = (c: Card) => ({ id: c.id, subject: c.subject, condition: c.condition });
const headroom = (g: GridLayout | null): number => (g === null ? 0 : g.width * g.height - g.pieces.reduce((n, p) => n + p.shape.length, 0));

describe('role templates (Ruling 134)', () => {
  it('reads each creature’s roles off its moves: strongest, strongest affordable, first self-buff (else strongest), signature', () => {
    expect(rolesOf('sagelet')).toEqual({ power: 'happy-to-help', affordable: 'proof-by-contradiction', setup: 'step-back-prompt', sig: 'happy-to-help' });
    expect(rolesOf('blitzr')).toEqual({ power: 'distilled-strike', affordable: 'distilled-strike', setup: 'low-latency', sig: 'ship-it' });
    expect(rolesOf('forkling')).toEqual({ power: 'hard-fork', affordable: 'hard-fork', setup: 'hard-fork', sig: 'hard-fork' });
    expect(rolesOf('tokenibble')).toEqual({ power: 'token-nibble', affordable: 'token-nibble', setup: 'low-latency', sig: 'token-nibble' });
  });
});

describe('starter triangle setup', () => {
  it('pits each starter against the starter it beats on the type chart', () => {
    expect(TRIANGLE.map(([f, v]) => `${f}>${v}`).sort()).toEqual(['blitzr>sagelet', 'forkling>blitzr', 'sagelet>forkling']);
    for (const [fav, beaten] of TRIANGLE) {
      expect(typeMultiplierBp(SPECIES[fav].types[0] as TypeId, SPECIES[beaten].types)).toBe(20000);
      expect(valid(starterSide(fav), starterSide(beaten))).toEqual([]);
    }
  });
  it('gives every starter the standard L8 grid with Tokenibble L8 in its slot, on one shared Tokenibble deck', () => {
    const sides = STARTERS.map((s) => [s, starterSide(s)] as const);
    for (const [species, a] of sides) {
      expect(a.side.orchestrator).toMatchObject({ species, level: 8 });
      expect(a.side.active.map((c) => [c.species, c.level])).toEqual([['tokenibble', 8]]);
      expect(a.side.bench).toEqual([]);
      expect(a.side.grid).toEqual(starterGrid(species, 8, a.side.active[0]?.id ?? ''));
    }
    const decks = sides.map(([, a]) => a.side.active[0]?.deck);
    expect(decks[1]).toEqual(decks[0]);
    expect(decks[2]).toEqual(decks[0]);
    expect(decks[0]?.cards.length).toBe(3);
  });
  it('builds every starter’s Autopilot from one role template: same cards, each holding its role’s move', () => {
    const [sag, ...rest] = STARTERS.map((s) => starterSide(s).side);
    for (const s of rest) expect(autopilotCards(s).map(shapeOf)).toEqual(autopilotCards(sag as SideSetup).map(shapeOf));
    for (const species of STARTERS) {
      const r = rolesOf(species);
      const byId = Object.fromEntries(autopilotCards(starterSide(species).side).map((c) => [c.id, c.move]));
      expect(byId).toEqual({ setup: r.setup, sig: r.sig, power: r.power, tidy: 'compact', default: r.affordable });
    }
  });
  it.each(TRIANGLE)('is live, %s vs %s: every side deals damage, its top card fires and its orchestrator attacks with its power or signature move', (fav, beaten) => {
    const x = starterSide(fav);
    const y = starterSide(beaten);
    const rs = both(x, y, 'live:triangle', 10);
    for (const side of [x, y]) {
      const mine = rs.map((r) => indicesOf(r, side));
      const damage = rs.reduce((n, r, i) => n + r.events.filter((e) => e.type === 'Damage' && mine[i]?.includes(e.actor)).length, 0);
      expect(damage, side.id).toBeGreaterThan(0);
      const top = side.side.autopilot?.deck.cards[0]?.id ?? '';
      expect(fired(rs, side.side.orchestrator.id, top), `${side.id} ${top}`).toBeGreaterThan(0);
      const r = rolesOf(side.side.orchestrator.species as (typeof STARTERS)[number]);
      const attacks = rs.reduce((n, b, i) => n + b.events.filter((e) => e.type === 'MoveUsed' && e.actor === mine[i]?.[0] && (e.moveId === r.power || e.moveId === r.sig)).length, 0);
      expect(attacks, `${side.id} uses ${r.power} or ${r.sig}`).toBeGreaterThan(0);
    }
  });
});

describe('graft vs spin-up setup (Ruling 134: base team Sagelet + Tokenibble)', () => {
  it('uses the first three slice species, not a starter or Tokenibble, whose graft fits the base grid', () => {
    expect(GRAFT_SPECIES).toEqual(['stochastiparrot', 'nullbeetle', 'off-by-wasp']);
    const skipped = SPECIES_IDS.slice(0, SPECIES_IDS.indexOf('off-by-wasp')).filter((s) => !GRAFT_SPECIES.includes(s));
    expect(skipped).toEqual(['sagelet', 'blitzr', 'forkling', 'tokenibble']);
  });

  it.each(GRAFT_SPECIES)('%s: G adds the graft, S adds the species in slot B; the rest is the base team', (species) => {
    const G = graftVariant(species);
    const S = spinUpVariant(species);
    const g = G.side;
    const s = S.side;
    expect(valid(G, S)).toEqual([]);
    for (const side of [g, s]) {
      expect(validateGrid(side.grid, 8).errors).toEqual([]);
      expect(side.orchestrator).toMatchObject({ species: GRAFT_STARTER, level: 8, moves: [] });
      expect(side.active[0]).toMatchObject({ species: 'tokenibble', level: 8 });
      expect(side.active[0]?.deck).toEqual(starterSide('sagelet').side.active[0]?.deck);
      expect(side.bench).toEqual([]);
    }
    // G: the base grid plus the signature as a graft piece (headroom 25 − 17 − its cells).
    expect(g.active).toHaveLength(1);
    const graft = g.grid?.pieces.find((p) => p.kind === 'graft');
    expect(graft).toMatchObject({ moveId: SPECIES[species].signature });
    expect(g.grid?.pieces.filter((p) => p !== graft)).toEqual(starterGrid(GRAFT_STARTER, 8, g.active[0]?.id ?? '').pieces);
    expect(headroom(g.grid)).toBe(8 - SPECIES[species].graftShape.length);
    // S: the base grid plus a 2×2 slot B for the species. The L8 grid holds no extra Example Card (headroom would fall
    // below 4), so slot B shares slot A's two right-hand Example Cards: 2 active cards, headroom exactly 4.
    expect(s.active.map((c) => [c.species, c.level])).toEqual([['tokenibble', 8], [species, 8]]);
    const slotB = s.grid?.pieces.find((p) => p.id === 'slot-B');
    expect(slotB).toMatchObject({ kind: 'subagentSlot', subagentId: s.active[1]?.id, anchor: [3, 1], shape: [[0, 0], [1, 0], [0, 1], [1, 1]] });
    expect(s.grid?.pieces.filter((p) => p !== slotB)).toEqual(starterGrid(GRAFT_STARTER, 8, s.active[0]?.id ?? '').pieces);
    if (s.grid === null) throw new Error('no grid');
    expect(activeCardCount(s.grid, 'slot-B', 'v2')).toBe(2);
    expect(activeCardCount(s.grid, 'slot-A', 'v2')).toBe(3);
    expect(headroom(s.grid)).toBe(4);
    expect(s.active[1]?.deck?.cards.length).toBe(2);
    // The Autopilots: G's is S's plus one graft card, which aims the grafted move.
    const gCards = autopilotCards(g);
    const sCards = autopilotCards(s);
    expect(gCards.filter((c) => c.id !== 'graft')).toEqual(sCards);
    expect(gCards.find((c) => c.id === 'graft')?.move).toBe(SPECIES[species].signature);
  });

  it.each(GRAFT_SPECIES)('is live, %s: the graft card fires in G', (species) => {
    const G = graftVariant(species);
    const rs = both(G, spinUpVariant(species), `live:graft:${species}`, 20);
    expect(fired(rs, G.side.orchestrator.id, 'graft')).toBeGreaterThan(0);
    const used = rs.reduce((n, r) => n + r.events.filter((e) => e.type === 'MoveUsed' && e.moveId === SPECIES[species].signature && indicesOf(r, G)[0] === e.actor).length, 0);
    expect(used).toBeGreaterThan(0);
  });
});

describe('temperature dial setup', () => {
  const first = ARCHETYPES.find((a) => a.id.startsWith('mixed-'));
  if (first === undefined) throw new Error('no mixed archetype');
  const [t0, t4] = temperatureSides();

  it('mirrors the first mixed archetype with one Autopilot at temperature 0 and the other at 4', () => {
    expect([t0.id, t4.id]).toEqual([first.id, first.id]);
    expect(t0.side.autopilot?.temperature).toBe(0);
    expect(t4.side.autopilot?.temperature).toBe(4);
    const strip = (s: SideSetup) => ({ ...s, autopilot: { ...s.autopilot, temperature: null } });
    expect(strip(t0.side)).toEqual(strip(first.side));
    expect(strip(t4.side)).toEqual(strip(mirrorOf(first, 't4').side));
    expect(valid(t0, t4)).toEqual([]);
  });

  it('is live: the engine runs the sides at T0 and T4, and only the T4 orchestrator hallucinates a move', () => {
    const s = createBattle(setupOf(t0, t4), seedFor('live:temperature', 0));
    expect([s.sides.a.temperature, s.sides.b.temperature]).toEqual([0, 4]);
    // An Autopilot always obeys, so a MoveUsed that differs from the move of the card it fired is a substitution
    // (a T3+ self-hallucination, spec §5 D2): never at T0, and seen at T4 over 80 battles.
    const substitutions = (x: Archetype) => {
      let n = 0;
      for (const r of both(t0, t4, 'live:temperature', 40)) {
        const orch = indicesOf(r, x)[0];
        const cards = autopilotCards(x.side);
        let planned: string | undefined;
        for (const e of r.events) {
          if (e.type === 'CardTrace' && e.actor === orch) planned = cards.find((c) => c.id === e.firedCardId)?.move;
          if (e.type === 'MoveUsed' && e.actor === orch && planned !== undefined) {
            if (e.moveId !== planned) n++;
            planned = undefined;
          }
        }
      }
      return n;
    };
    expect(substitutions(t0)).toBe(0);
    expect(substitutions(t4)).toBeGreaterThan(0);
  });
});

describe('first mover setup', () => {
  it.each(ARCHETYPES.map((a) => a.id))('is live, %s: its mirror is exact apart from creature ids', (id) => {
    const x = ARCHETYPES.find((a) => a.id === id) as Archetype;
    const m = mirrorOf(x, 'm');
    expect(m.id).toBe(x.id);
    expect(JSON.parse(JSON.stringify(m.side).replace(/~m"/g, '"'))).toEqual(x.side);
    const ids = (s: SideSetup) => members(s).map((c) => c.id);
    expect(ids(m.side)).toEqual(ids(x.side).map((i) => `${i}~m`));
    expect(valid(x, m)).toEqual([]);
  });
});
