import { activeCardCount, SPECIES, typeMultiplierBp, validateGrid, validateSetup, type Card, type SideSetup, type TypeId } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { ARCHETYPES, mirrorOf, starterGrid } from '../src/archetypes/index.js';
import { STARTER_SKILLS } from '../src/archetypes/starter-grids.js';
import { UsageError } from '../src/args.js';
import { targetsCommand } from '../src/commands/targets.js';
import { GRAFT_SPECIES, GRAFT_STARTER, graftVariant, spinUpVariant, starterSide, temperatureSides, TRIANGLE } from '../src/target-setups.js';
import { measureTargets, scaled, TARGETS, targetVerdict } from '../src/targets.js';
import type { Archetype } from '../src/types.js';
import { csvRows, readOut, testContext } from './helpers/context.js';

const valid = (a: Archetype, b: Archetype) => validateSetup({ a: { ...a.side, opponentId: b.id }, b: { ...b.side, opponentId: a.id }, kind: 'trainer' }).errors;
/** A card without its move and target: the template's shape. */
const shapeOf = (c: Card) => ({ id: c.id, subject: c.subject, condition: c.condition });
const autopilotCards = (s: SideSetup): Card[] => {
  const d = s.autopilot?.deck;
  if (d === undefined) throw new Error('no autopilot');
  return [...d.cards, d.default];
};

describe('TARGETS (spec §9)', () => {
  it('lists the seven targets in table order with their seeds and pass bands', () => {
    expect(TARGETS.map((t) => [t.id, t.seeds, t.band, t.pointOnly])).toEqual([
      ['vs-field', '1,000 per ordered pairing', [0, 0.55], false],
      ['worst-matchup', '2,000 per pairing', [0.3, 1], false],
      ['starter-triangle', '2,000', [0.55, 0.65], false],
      ['temperature-dial', '2,000', [0.45, 0.55], false],
      ['graft-vs-spin-up', '2,000', [0.45, 0.55], false],
      ['fight-length', 'all', [5, 8], true],
      ['first-mover', '10,000', [0.48, 0.52], false],
    ]);
    expect(Object.isFrozen(TARGETS)).toBe(true);
  });
  it('a target’s verdict is its worst row: any fail fails, else any inconclusive is inconclusive', () => {
    expect(targetVerdict(['pass', 'pass'])).toBe('pass');
    expect(targetVerdict(['pass', 'inconclusive'])).toBe('inconclusive');
    expect(targetVerdict(['inconclusive', 'fail', 'pass'])).toBe('fail');
  });
});

describe('scaled (--seeds-scale)', () => {
  it('multiplies, rounds up, and never goes below 1', () => {
    expect(scaled(1000, 1)).toBe(1000);
    expect(scaled(1000, 0.01)).toBe(10);
    expect(scaled(500, 0.003)).toBe(2);
    expect(scaled(1000, 0.0001)).toBe(1);
    expect(scaled(100, 0.07)).toBe(7); // 100 * 0.07 is 7.000000000000001 in floating point
    expect(scaled(1000, 2.5)).toBe(2500);
  });
});

describe('starter triangle setup (Ruling 133)', () => {
  it('pits each starter against the starter it beats on the type chart', () => {
    expect(TRIANGLE.map(([f, v]) => `${f}>${v}`).sort()).toEqual(['blitzr>sagelet', 'forkling>blitzr', 'sagelet>forkling']);
    for (const [fav, beaten] of TRIANGLE) {
      expect(typeMultiplierBp(SPECIES[fav].types[0] as TypeId, SPECIES[beaten].types)).toBe(20000);
      expect(valid(starterSide(fav), starterSide(beaten))).toEqual([]);
    }
  });
  it('gives every starter the standard L8 grid with Tokenibble L8 in its slot, on one shared Tokenibble deck', () => {
    const sides = (['sagelet', 'blitzr', 'forkling'] as const).map((s) => [s, starterSide(s)] as const);
    for (const [species, a] of sides) {
      expect(a.side.orchestrator).toMatchObject({ species, level: 8 });
      expect(a.side.active).toHaveLength(1);
      expect(a.side.bench).toEqual([]);
      expect(a.side.active[0]).toMatchObject({ species: 'tokenibble', level: 8 });
      expect(a.side.grid).toEqual(starterGrid(species, 8, a.side.active[0]?.id ?? ''));
    }
    const decks = sides.map(([, a]) => a.side.active[0]?.deck);
    expect(decks[1]).toEqual(decks[0]);
    expect(decks[2]).toEqual(decks[0]);
  });
  it('instantiates one 8-card Autopilot template per starter: same cards, only the moves differ', () => {
    const [sag, bli, frk] = (['sagelet', 'blitzr', 'forkling'] as const).map((s) => starterSide(s).side);
    if (sag === undefined || bli === undefined || frk === undefined) throw new Error('missing side');
    expect(sag.autopilot?.deck.cards).toHaveLength(8);
    expect(autopilotCards(bli).map(shapeOf)).toEqual(autopilotCards(sag).map(shapeOf));
    expect(autopilotCards(frk).map(shapeOf)).toEqual(autopilotCards(sag).map(shapeOf));
    expect(bli.autopilot?.temperature).toBe(sag.autopilot?.temperature);
    const moves = new Set(autopilotCards(bli).map((c) => c.move));
    const s = STARTER_SKILLS.blitzr;
    for (const m of moves) expect(['ship-it', s.K, s.M, s.L, 'guardrail', 'compact']).toContain(m);
  });
});

describe('graft vs spin-up setup (Ruling 133)', () => {
  it('uses three non-starter slice species whose graft shape fits the starter grid’s 2×2 slot', () => {
    expect(GRAFT_SPECIES).toHaveLength(3);
    for (const s of GRAFT_SPECIES) {
      expect(['sagelet', 'blitzr', 'forkling']).not.toContain(s);
      expect(Math.max(...SPECIES[s].graftShape.map((c) => c[0]))).toBeLessThanOrEqual(1);
      expect(Math.max(...SPECIES[s].graftShape.map((c) => c[1]))).toBeLessThanOrEqual(1);
    }
  });
  it.each(GRAFT_SPECIES)('%s: G grafts its signature where S spins it up in a 2×2 slot with 3 Example Cards', (species) => {
    const g = graftVariant(species).side;
    const s = spinUpVariant(species).side;
    expect(valid(graftVariant(species), spinUpVariant(species))).toEqual([]);
    expect(validateGrid(g.grid, g.orchestrator.level).errors).toEqual([]);
    // S: the standard starter grid, the species as its one subagent.
    expect(s.active.map((c) => [c.species, c.level])).toEqual([[species, 8]]);
    expect(s.grid).toEqual(starterGrid(GRAFT_STARTER, 8, s.active[0]?.id ?? ''));
    const slot = s.grid?.pieces.find((p) => p.kind === 'subagentSlot');
    if (s.grid === null || slot === undefined) throw new Error('no slot');
    expect(activeCardCount(s.grid, slot.id, 'v2')).toBe(3);
    expect(s.active[0]?.deck?.cards.length).toBeLessThanOrEqual(3);
    // G: no subagent; the slot and its Example Cards give way to the graft, in the slot's place; the rest is identical.
    expect(g.active).toEqual([]);
    const graft = g.grid?.pieces.find((p) => p.kind === 'graft');
    expect(graft).toMatchObject({ moveId: SPECIES[species].signature, anchor: slot.anchor, shape: SPECIES[species].graftShape });
    const kept = s.grid.pieces.filter((p) => p.kind !== 'subagentSlot' && p.kind !== 'exampleCard');
    expect(g.grid?.pieces.filter((p) => p.kind !== 'graft')).toEqual(kept);
    expect(g.grid?.pieces.indexOf(graft as never)).toBe(s.grid.pieces.indexOf(slot));
    expect(g.orchestrator).toEqual({ ...s.orchestrator, id: g.orchestrator.id });
    // The Autopilot decks differ only in the coin card, which aims the graft in G.
    const gCards = autopilotCards(g);
    const sCards = autopilotCards(s);
    expect(gCards.map(shapeOf)).toEqual(sCards.map(shapeOf));
    const diff = gCards.flatMap((c, i) => (JSON.stringify(c) === JSON.stringify(sCards[i]) ? [] : [c]));
    expect(diff.map((c) => [c.id, c.move])).toEqual([['coin', SPECIES[species].signature]]);
    expect(g.autopilot?.temperature).toBe(s.autopilot?.temperature);
  });
});

describe('temperature dial setup (Ruling 133)', () => {
  it('mirrors the first mixed archetype with one Autopilot at temperature 0 and the other at 4', () => {
    const first = ARCHETYPES.find((a) => a.id.startsWith('mixed-'));
    if (first === undefined) throw new Error('no mixed archetype');
    const [t0, t4] = temperatureSides();
    expect([t0.id, t4.id]).toEqual([first.id, first.id]);
    expect(t0.side.autopilot?.temperature).toBe(0);
    expect(t4.side.autopilot?.temperature).toBe(4);
    const strip = (s: SideSetup) => ({ ...s, autopilot: { ...s.autopilot, temperature: null } });
    expect(strip(t0.side)).toEqual(strip(first.side));
    expect(strip(t4.side)).toEqual(strip(mirrorOf(first, 't4').side));
    expect(valid(t0, t4)).toEqual([]);
  });
});

describe('measureTargets', () => {
  it('is deterministic: the same scale gives the same rows', () => {
    const opts = { scale: 0.001, now: () => 0, progress: () => undefined };
    const a = measureTargets(opts).rows;
    expect(measureTargets(opts).rows).toEqual(a);
  }, 120_000);
});

describe('targets command', () => {
  it('runs `targets --seeds-scale 0.01` and reports every target', async () => {
    const ctx = testContext();
    expect(await targetsCommand(['--seeds-scale', '0.01'], ctx)).toBe(0);
    const md = readOut(ctx, 'targets-2026-01-02.md');
    for (const t of TARGETS) expect(md).toContain(t.name);
    const rows = csvRows(readOut(ctx, 'targets-2026-01-02.csv')).slice(1);
    const battles = (target: string) => rows.filter((r) => r[0] === target).map((r) => Number(r[2]));
    expect(battles('vs-field')).toEqual(Array(20).fill(380));
    expect(battles('worst-matchup')).toEqual(Array(21).fill(20));
    expect(battles('starter-triangle')).toEqual([20, 20, 20]);
    expect(battles('temperature-dial')).toEqual([20]);
    expect(battles('graft-vs-spin-up')).toEqual([20, 20, 20]);
    expect(battles('fight-length')).toEqual([3800]);
    expect(battles('first-mover')).toEqual([100]);
    for (const r of rows) expect(['pass', 'fail', 'inconclusive']).toContain(r[8]);
    expect(ctx.lines.length).toBeGreaterThan(0);
  }, 120_000);
  it('rejects a seed scale that is not a positive number', async () => {
    for (const bad of ['0', '-1', 'abc', '']) await expect(targetsCommand(['--seeds-scale', bad], testContext())).rejects.toThrow(UsageError);
  });
});
