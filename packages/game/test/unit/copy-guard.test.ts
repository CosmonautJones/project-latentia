import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Latentia's jokes are its own: no echoes of another franchise's trademarked slogans or stock battle lines in the
// shipped source (P2 follow-up b replaced the old title tagline).
const BANNED = [/gotta/i, /'em all/i, /catch them all/i, /wild .{0,40} appeared/i, /super[- ]effective/i, /pok[eé]mon/i, /pikachu/i];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? sourceFiles(p) : /\.(ts|html|css)$/.test(e.name) ? [p] : [];
  });
}

describe('player-facing copy', () => {
  const root = join(import.meta.dirname, '../../src');
  const files = [...sourceFiles(root), join(import.meta.dirname, '../../index.html')];

  it('scans the game source', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(BANNED.map((re) => [String(re), re] as const))('never contains %s', (_name, re) => {
    const hits = files.filter((f) => re.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
