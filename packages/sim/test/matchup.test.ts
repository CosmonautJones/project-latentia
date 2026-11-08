import { describe, expect, it } from 'vitest';
import { UsageError } from '../src/args.js';
import { ARCHETYPES } from '../src/archetypes/index.js';
import { matchupCommand } from '../src/commands/matchup.js';
import { runMatch } from '../src/runner.js';
import { csvRows, readOut, testContext } from './helpers/context.js';

const [A, B] = ARCHETYPES as [(typeof ARCHETYPES)[number], (typeof ARCHETYPES)[number]];

describe('matchup command', () => {
  it('writes a round-length histogram whose bucket counts sum to N', async () => {
    const ctx = testContext();
    expect(await matchupCommand([A.id, B.id, '--seeds', '37'], ctx)).toBe(0);
    const rows = csvRows(readOut(ctx, 'matchup-2026-01-02.csv'));
    expect(rows[0]).toEqual(['rounds', 'battles']);
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
  it('reports side A’s wins, losses, draws and score with its interval', async () => {
    const ctx = testContext();
    await matchupCommand([A.id, B.id, '--seeds', '20'], ctx);
    const md = readOut(ctx, 'matchup-2026-01-02.md');
    const s = runMatch(A, B, 20, `matchup:${A.id}:${B.id}`);
    expect(md).toContain(`| ${A.id} | ${B.id} | 20 | ${s.winsA} | ${s.winsB} | ${s.draws} |`);
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
    await expect(matchupCommand([A.id], ctx)).rejects.toThrow(UsageError);
    await expect(matchupCommand([A.id, B.id, '--seeds', '0'], ctx)).rejects.toThrow(UsageError);
    await expect(matchupCommand([A.id, B.id, '--seeds', '1.5'], ctx)).rejects.toThrow(UsageError);
  });
});
