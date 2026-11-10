import { activeCardCount, createBattle, simulate, SPECIES, SPECIES_IDS, typeMultiplierBp, validateGrid, validateSetup, type BattleResult, type Card, type GridLayout, type SideSetup, type TypeId } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { cardFires } from '../src/archetypes/headlines.js';
import { ARCHETYPES, mirrorOf, starterGrid } from '../src/archetypes/index.js';
import { seedFor } from '../src/runner.js';
import { baseTeam, GRAFT_SPECIES, GRAFT_STARTER, graftVariant, rolesOf, SPIN_UP_CARDS, SPIN_UP_LEVEL, spinUpVariant, spunUpMoves, starterSide, temperaturePair, TRIANGLE } from '../src/target-setups.js';
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
      expect(typeMultiplierBp(SPECIES[fav].types[0] as TypeId, SPECIES[beaten].types)).toBe(15000);
      expect(valid(starterSide(fav), starterSide(beaten))).toEqual([]);
    }
  });
  it('plays every starter alone (Ruling 146): orchestrator only, on the standard L8 grid with its slot left empty', () => {
    for (const species of STARTERS) {
      const side = starterSide(species).side;
      expect(side.orchestrator).toMatchObject({ species, level: 8 });
      expect(side.active).toEqual([]);
      expect(side.bench).toEqual([]);
      const standard = starterGrid(species, 8, 'unused');
      expect(headroom(side.grid)).toBe(headroom(standard));
      expect(side.grid?.pieces.some((p) => p.subagentId !== undefined)).toBe(false);
      expect(side.grid?.pieces.map((p) => p.id)).toEqual(standard.pieces.map((p) => p.id));
    }
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
  it.each(TRIANGLE)('is live, %s vs %s: every side acts, fires its top card and attacks with its power or signature move, and the favoured one deals damage', (fav, beaten) => {
    const x = starterSide(fav);
    const y = starterSide(beaten);
    const rs = both(x, y, 'live:triangle', 10);
    expect(rs.reduce((n, r) => n + r.events.filter((e) => e.type === 'Damage' && indicesOf(r, x).includes(e.actor)).length, 0), `${x.id} deals damage`).toBeGreaterThan(0);
    for (const side of [x, y]) {
      const mine = rs.map((r) => indicesOf(r, side));
      const top = side.side.autopilot?.deck.cards[0]?.id ?? '';
      expect(fired(rs, side.side.orchestrator.id, top), `${side.id} ${top}`).toBeGreaterThan(0);
      const r = rolesOf(side.side.orchestrator.species as (typeof STARTERS)[number]);
      const attacks = rs.reduce((n, b, i) => n + b.events.filter((e) => e.type === 'MoveUsed' && e.actor === mine[i]?.[0] && (e.moveId === r.power || e.moveId === r.sig)).length, 0);
      expect(attacks, `${side.id} uses ${r.power} or ${r.sig}`).toBeGreaterThan(0);
    }
  });
});

describe('graft setups (Rulings 134, 147: base team Sagelet + Tokenibble)', () => {
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
    const base = baseTeam();
    expect(valid(G, S)).toEqual([]);
    expect(valid(G, base)).toEqual([]);
    for (const side of [g, s, base.side]) {
      expect(validateGrid(side.grid, 8).errors).toEqual([]);
      expect(side.orchestrator).toMatchObject({ species: GRAFT_STARTER, level: 8, moves: [] });
      expect(side.active[0]).toMatchObject({ species: 'tokenibble', level: 8 });
      expect(side.active[0]?.deck).toEqual(base.side.active[0]?.deck);
      expect(side.bench).toEqual([]);
    }
    // The base team: the starter grid with Tokenibble in its slot, no graft and no second subagent.
    expect(base.side.active).toHaveLength(1);
    expect(base.side.grid).toEqual(starterGrid(GRAFT_STARTER, 8, base.side.active[0]?.id ?? ''));
    expect(autopilotCards(base.side).some((c) => c.id === 'graft')).toBe(false);
    // G: the base grid plus the signature as a graft piece (headroom 25 − 17 − its cells).
    expect(g.active).toHaveLength(1);
    const graft = g.grid?.pieces.find((p) => p.kind === 'graft');
    expect(graft).toMatchObject({ moveId: SPECIES[species].signature });
    expect(g.grid?.pieces.filter((p) => p !== graft)).toEqual(starterGrid(GRAFT_STARTER, 8, g.active[0]?.id ?? '').pieces);
    expect(headroom(g.grid)).toBe(8 - SPECIES[species].graftShape.length);
    // S: the base grid plus a 2×2 slot B for the species, placed where exactly one Example Card touches it (Ruling 147:
    // a freshly spun-up subagent has 1 active card slot), with no card added: headroom exactly 4. It joins at L5, the
    // defeated wild model's level (Ruling 145), with its 3 moves and no signature (bible:250, Ruling 143).
    expect(SPIN_UP_LEVEL).toBe(5);
    expect(SPIN_UP_CARDS).toBe(1);
    expect(s.active.map((c) => [c.species, c.level, c.version])).toEqual([['tokenibble', 8, 'v2'], [species, 5, 'v1']]);
    const spun = s.active[1];
    const sig = SPECIES[species].signature;
    expect(spun?.moves).toEqual(SPECIES[species].moves.filter((m) => m !== sig));
    expect(spun?.moves).toEqual(spunUpMoves(species));
    expect(spun?.moves).toHaveLength(3);
    const spunCards = [...(spun?.deck?.cards ?? []), spun?.deck?.default];
    expect(spunCards.map((c) => c?.move)).not.toContain(sig);
    expect(spunCards.map((c) => c?.id)).toEqual(['setup', 'default']);
    const slotB = s.grid?.pieces.find((p) => p.id === 'slot-B');
    expect(slotB).toMatchObject({ kind: 'subagentSlot', subagentId: s.active[1]?.id, anchor: [3, 0], shape: [[0, 0], [1, 0], [0, 1], [1, 1]] });
    expect(s.grid?.pieces.filter((p) => p !== slotB)).toEqual(starterGrid(GRAFT_STARTER, 8, s.active[0]?.id ?? '').pieces);
    if (s.grid === null) throw new Error('no grid');
    expect(activeCardCount(s.grid, 'slot-B', 'v1')).toBe(1);
    expect(activeCardCount(s.grid, 'slot-B', 'v4')).toBe(1); // uncapped by version: exactly one Example Card touches the slot
    expect(activeCardCount(s.grid, 'slot-A', 'v2')).toBe(3);
    expect(headroom(s.grid)).toBe(4);
    expect(s.active[1]?.deck?.cards.length).toBe(1);
    // The Autopilots: G's is S's and the base team's plus one graft card, which aims the grafted move.
    const gCards = autopilotCards(g);
    const sCards = autopilotCards(s);
    expect(gCards.filter((c) => c.id !== 'graft')).toEqual(sCards);
    expect(gCards.filter((c) => c.id !== 'graft')).toEqual(autopilotCards(base.side));
    expect(gCards.find((c) => c.id === 'graft')?.move).toBe(SPECIES[species].signature);
  });

  it.each(GRAFT_SPECIES)('is live, %s (a graft is worth taking): the graft card fires and its signature is used, on the base team’s side only', (species) => {
    const G = graftVariant(species);
    const base = baseTeam();
    const rs = both(G, base, `live:graft-worth:${species}`, 20);
    expect(fired(rs, G.side.orchestrator.id, 'graft')).toBeGreaterThan(0);
    expect(fired(rs, base.side.orchestrator.id, 'graft')).toBe(0);
    const sig = SPECIES[species].signature;
    const used = (x: Archetype) => rs.reduce((n, r) => n + r.events.filter((e) => e.type === 'MoveUsed' && e.moveId === sig && indicesOf(r, x)[0] === e.actor).length, 0);
    expect(used(G)).toBeGreaterThan(0);
    expect(used(base)).toBe(0);
  });

  it.each(GRAFT_SPECIES)('is live, %s (diagnostic G vs S): S’s L5 spun-up subagent has exactly 1 active card and acts without its signature', (species) => {
    const G = graftVariant(species);
    const S = spinUpVariant(species);
    const rs = both(G, S, `live:graft:${species}`, 20);
    const sig = SPECIES[species].signature;
    if (S.side.grid === null) throw new Error('no grid');
    expect(activeCardCount(S.side.grid, 'slot-B', S.side.active[1]?.version ?? 'v1')).toBe(1);
    // The spun-up subagent is S's third creature (orchestrator, Tokenibble, it), and it plays at L5.
    const spunMoves = rs.flatMap((r) => r.events.filter((e) => e.type === 'MoveUsed' && e.actor === indicesOf(r, S)[2]).map((e) => (e.type === 'MoveUsed' ? e.moveId : '')));
    expect(spunMoves.length).toBeGreaterThan(0);
    expect(spunMoves).not.toContain(sig);
    expect(createBattle(setupOf(G, S), seedFor('live:graft-level', 0)).creatures.find((c) => c.id === S.side.active[1]?.id)?.level).toBe(SPIN_UP_LEVEL);
  });
});

describe('temperature dial setup (Ruling 143 I2: every archetype)', () => {
  const first = ARCHETYPES.find((a) => a.id.startsWith('mixed-'));
  if (first === undefined) throw new Error('no mixed archetype');
  const [t0, t4] = temperaturePair(first);

  it.each(ARCHETYPES.map((a) => a.id))('mirrors %s with one Autopilot at temperature 0 and the other at 4', (id) => {
    const x = ARCHETYPES.find((a) => a.id === id) as Archetype;
    const [c, h] = temperaturePair(x);
    expect([c.id, h.id]).toEqual([x.id, x.id]);
    expect(c.side.autopilot?.temperature).toBe(0);
    expect(h.side.autopilot?.temperature).toBe(4);
    const strip = (s: SideSetup) => ({ ...s, autopilot: { ...s.autopilot, temperature: null } });
    expect(strip(c.side)).toEqual(strip(x.side));
    expect(strip(h.side)).toEqual(strip(mirrorOf(x, 't4').side));
    expect(valid(c, h)).toEqual([]);
  });

  it('is live: the engine runs the sides at T0 and T4, and only the T4 orchestrator hallucinates a move', () => {
    const s = createBattle(setupOf(t0, t4), seedFor('live:temperature', 0));
    expect([s.sides.a.temperature, s.sides.b.temperature]).toEqual([0, 4]);
    // An Autopilot always obeys, so a MoveUsed that differs from the move of the card it fired is a substitution
    // (a T3+ self-hallucination, spec §5 D2): never at T0, and seen at T4 over 80 battles. Drift (5% random move per
    // stack, spec §5 D1) also substitutes a move, so only rounds where the orchestrator holds no Drift count.
    // The exclusion is conservative: it discards every substitution made while Drift is held, hallucinations included, so it can
    // only hide a T0 substitution from the zero check (a T0 Drift substitution is legitimate) and the T4 check still has to see one
    // outside Drift. It never turns a battle with no substitution into one with.
    const substitutions = (x: Archetype) => {
      let n = 0;
      for (const r of both(t0, t4, 'live:temperature', 40)) {
        const orch = indicesOf(r, x)[0];
        const cards = autopilotCards(x.side);
        let planned: string | undefined;
        let drift = 0;
        for (const e of r.events) {
          if (e.type === 'DriftChanged' && e.target === orch) drift = e.drift;
          if (e.type === 'CardTrace' && e.actor === orch) planned = cards.find((c) => c.id === e.firedCardId)?.move;
          if (e.type === 'MoveUsed' && e.actor === orch && planned !== undefined) {
            if (e.moveId !== planned && drift === 0) n++;
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
