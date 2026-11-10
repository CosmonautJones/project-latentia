import { describe, expect, it } from 'vitest';
import { UsageError } from '../src/args.js';
import { ARCHETYPES } from '../src/archetypes/index.js';
import { histogram, matchupCommand } from '../src/commands/matchup.js';
import { runMatch, runPooled } from '../src/runner.js';
import { rate } from '../src/stats.js';
import { csvRows, readOut, testContext } from './helpers/context.js';

const [A, B] = ARCHETYPES as [(typeof ARCHETYPES)[number], (typeof ARCHETYPES)[number]];

describe('matchup command', () => {
  it('pools both side assignments by default (Ruling 143): N per side, 2N in all, as runPooled scores them', async () => {
    const ctx = testContext();
    expect(await matchupCommand([A.id, B.id, '--seeds', '15'], ctx)).toBe(0);
    const md = readOut(ctx, 'matchup-2026-01-02.md');
    const ab = runMatch(A, B, 15, `matchup:${A.id}:${B.id}:ab`);
    const ba = runMatch(B, A, 15, `matchup:${A.id}:${B.id}:ba`);
    const pooled = runPooled(A, B, 15, `matchup:${A.id}:${B.id}`);
    expect(md).toContain(`| a | ${A.id} | ${B.id} | 15 | ${ab.winsA} | ${ab.winsB} | ${ab.draws} |`);
    expect(md).toContain(`| b | ${A.id} | ${B.id} | 15 | ${ba.winsB} | ${ba.winsA} | ${ba.draws} |`);
    expect(md).toContain(`| both (pooled) | ${A.id} | ${B.id} | 30 | ${ab.winsA + ba.winsB} | ${ab.winsB + ba.winsA} | ${ab.draws + ba.draws} | ${(100 * rate(pooled.score)).toFixed(1)}% |`);
    expect(md).toContain('- seed scale: 15 (seeds per side assignment)');
    const rows = csvRows(readOut(ctx, 'matchup-2026-01-02.csv')).slice(1);
    expect(rows.reduce((n, r) => n + Number(r[1]), 0)).toBe(30);
  });
  it('writes a round-length histogram whose bucket counts sum to N with --one-sided', async () => {
    const ctx = testContext();
    expect(await matchupCommand([A.id, B.id, '--seeds', '37', '--one-sided'], ctx)).toBe(0);
    const rows = csvRows(readOut(ctx, 'matchup-2026-01-02.csv'));
    expect(rows[0]?.slice(0, 2)).toEqual(['rounds', 'battles']);
    const buckets = rows.slice(1).map(([r, n]) => [Number(r), Number(n)] as const);
    expect(buckets.reduce((s, [, n]) => s + n, 0)).toBe(37);
    // One bucket per round count from the shortest battle to the longest, in order.
    const rounds = buckets.map(([r]) => r);
    expect(rounds).toEqual(Array.from({ length: rounds.length }, (_, i) => (rounds[0] ?? 0) + i));
    const stats = runMatch(A, B, 37, `matchup:${A.id}:${B.id}`);
    expect(rounds[0]).toBe(Math.min(...stats.rounds));
    expect(rounds.at(-1)).toBe(Math.max(...stats.rounds));
    for (const [r, n] of buckets) expect(n).toBe(stats.rounds.filter((x) => x === r).length);
  });
  it('--one-sided reports side A’s wins, losses, draws and score on the old one-sided seeds, with no side-b line', async () => {
    const ctx = testContext();
    await matchupCommand([A.id, B.id, '--seeds', '20', '--one-sided'], ctx);
    const md = readOut(ctx, 'matchup-2026-01-02.md');
    const s = runMatch(A, B, 20, `matchup:${A.id}:${B.id}`);
    expect(md).toContain(`| a | ${A.id} | ${B.id} | 20 | ${s.winsA} | ${s.winsB} | ${s.draws} |`);
    expect(md).not.toContain('| both (pooled) |');
    expect(md).toContain('## Round-length histogram');
  });
  it('plays an archetype against its mirror', async () => {
    const ctx = testContext();
    expect(await matchupCommand([A.id, A.id, '--seeds', '5'], ctx)).toBe(0);
    expect(readOut(ctx, 'matchup-2026-01-02.md')).toContain(`${A.id} (mirror)`);
  });
  it('rejects unknown archetypes and a bad seed count with a UsageError', async () => {
    const ctx = testContext();
    await expect(matchupCommand(['nope', B.id, '--seeds', '5'], ctx)).rejects.toThrow(UsageError);
    await expect(matchupCommand([A.id], ctx)).rejects.toThrow(/missing <b>/);
    await expect(matchupCommand([A.id, B.id, 'extra'], ctx)).rejects.toThrow(/unexpected argument extra/);
    await expect(matchupCommand([A.id, B.id, '--seed', '5'], ctx)).rejects.toThrow(/unknown flag --seed/);
    await expect(matchupCommand([A.id, B.id, '--seeds', '0'], ctx)).rejects.toThrow(UsageError);
    await expect(matchupCommand([A.id, B.id, '--seeds', '1.5'], ctx)).rejects.toThrow(UsageError);
    await expect(matchupCommand([A.id, B.id, '--one-sided=yes'], ctx)).rejects.toThrow(/--one-sided takes no value/);
    await expect(matchupCommand([A.id, B.id, '--one-sided', '--one-sided'], ctx)).rejects.toThrow(/given twice/);
  });
});

describe('histogram', () => {
  it('handles more round counts than a spread argument list allows', () => {
    const rounds = Array.from({ length: 300_000 }, (_, i) => 1 + (i % 50));
    const h = histogram(rounds);
    expect(h).toHaveLength(50);
    expect(h[0]).toEqual([1, 6000]);
    expect(h.at(-1)).toEqual([50, 6000]);
    expect(histogram([])).toEqual([]);
  });
});
