import { SPECIES, type CreatureSetup, type SideSetup } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { roundRobinCommand } from '../src/commands/round-robin.js';
import { allRounds, totalCapHits, fieldScore, pairingLabel, pairingScore, roundRobin, unorderedPairings, worstPairing } from '../src/round-robin.js';
import { runMatch } from '../src/runner.js';
import type { Archetype } from '../src/types.js';
import { ENGINE_VERSION } from '@latentia/engine';
import { ARCHETYPES } from '../src/archetypes/index.js';
import { PROVENANCE_COLUMNS } from '../src/report.js';
import { csvRows, readOut, TEST_PROVENANCE, testContext } from './helpers/context.js';

const mon = (id: string, species: keyof typeof SPECIES): CreatureSetup => ({ id, species, level: 5, version: 'v1', moves: [...SPECIES[species].moves] });
const side = (tag: string, orch: keyof typeof SPECIES, act: keyof typeof SPECIES): SideSetup => ({
  orchestrator: mon(`${tag}/orch`, orch),
  active: [mon(`${tag}/act`, act)],
  bench: [],
  grid: null,
  opponentId: 'field',
});
/** Three tiny ungridded archetypes, one starter and one subagent each. */
const TINY: Archetype[] = [
  { id: 'x', side: side('x', 'sagelet', 'tokenibble') },
  { id: 'y', side: side('y', 'blitzr', 'nullbeetle') },
  { id: 'z', side: side('z', 'forkling', 'cobolt') },
];

describe('roundRobin', () => {
  const rr = roundRobin(TINY, 7, 'rr-test');

  it('runs 3 archetypes as 3 unordered and 6 ordered pairings, each with the seed count', () => {
    expect(rr.ordered.map((p) => `${p.a}>${p.b}`)).toEqual(['x>y', 'x>z', 'y>x', 'y>z', 'z>x', 'z>y']);
    expect(unorderedPairings(rr)).toEqual([['x', 'y'], ['x', 'z'], ['y', 'z']]);
    for (const p of rr.ordered) expect(p.stats.winsA + p.stats.winsB + p.stats.draws).toBe(7);
  });
  it('records its label, and each ordered pairing’s seed label', () => {
    expect(rr.label).toBe('rr-test');
    expect(pairingLabel(rr, { a: 'x', b: 'y' })).toBe('rr-test:x:y');
  });
  it('seeds each ordered pairing with its own label', () => {
    const [x, y] = TINY as [Archetype, Archetype];
    expect(rr.ordered[0]?.stats).toEqual(runMatch(x, y, 7, 'rr-test:x:y'));
    expect(rr.ordered[2]?.stats).toEqual(runMatch(y, x, 7, 'rr-test:y:x'));
  });
  it('pools a pairing over both orderings and a field score over every battle of the archetype', () => {
    const xy = rr.ordered[0]?.stats;
    const yx = rr.ordered[2]?.stats;
    if (xy === undefined || yx === undefined) throw new Error('missing pairing');
    const xyScore = pairingScore(rr, 'x', 'y');
    expect(xyScore).toEqual({ points: xy.winsA + yx.winsB + (xy.draws + yx.draws) / 2, n: 14 });
    expect(pairingScore(rr, 'y', 'x').points).toBe(14 - xyScore.points);
    const field = fieldScore(rr, 'x');
    expect(field.n).toBe(28);
    expect(field.points).toBe(xyScore.points + pairingScore(rr, 'x', 'z').points);
  });
  it('totals the cap hits of every pairing', () => {
    expect(totalCapHits(rr)).toBe(rr.ordered.reduce((n, p) => n + p.stats.capHits, 0));
  });
  it('finds each archetype’s worst pairing and every round count', () => {
    const w = worstPairing(rr, 'x');
    const other = w.foe === 'y' ? 'z' : 'y';
    expect(w.score.points).toBeLessThanOrEqual(pairingScore(rr, 'x', other).points);
    expect(allRounds(rr)).toHaveLength(42);
  });
  it('reports progress once per archetype', () => {
    const seen: [number, number][] = [];
    roundRobin(TINY, 1, 'rr-progress', (done, total) => seen.push([done, total]));
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]]);
  });
});

describe('round-robin command', () => {
  it('runs the 20 archetypes (380 ordered pairings) and writes the report and one CSV row per ordered pairing', async () => {
    const ctx = testContext();
    expect(await roundRobinCommand(['--seeds', '1'], ctx)).toBe(0);
    const md = readOut(ctx, 'round-robin-2026-01-02.md');
    expect(md).toContain('380 ordered pairings');
    expect(md).toContain('1 seed per ordered pairing');
    const rows = csvRows(readOut(ctx, 'round-robin-2026-01-02.csv'));
    expect(rows[0]).toEqual(['a', 'b', 'battles', 'wins_a', 'wins_b', 'draws', 'score_a', 'median_rounds', 'seed_label', ...PROVENANCE_COLUMNS]);
    expect(rows).toHaveLength(381);
    // seed_label is the label each pairing's seeds were drawn from: seedFor(seed_label, i) for battle i.
    const [first] = ARCHETYPES as [Archetype, Archetype];
    const second = ARCHETYPES[1] as Archetype;
    expect(rows[1]?.slice(0, 2)).toEqual([first.id, second.id]);
    expect(rows[1]?.[8]).toBe(`round-robin:${first.id}:${second.id}`);
    expect(runMatch(first, second, 1, rows[1]?.[8] as string).winsA).toBe(Number(rows[1]?.[3]));
    for (const r of rows.slice(1)) expect(r.slice(9)).toEqual([ENGINE_VERSION, '1', TEST_PROVENANCE.fingerprint, TEST_PROVENANCE.git?.sha, 'false']);
    expect(ctx.lines.filter((l) => l.startsWith('round-robin: '))).toHaveLength(20);
    expect(md).toMatch(/round-cap hits \(BattleEnd reason cap\) \d+/);
  }, 60_000);
});
