import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished } from 'vitest';
import type { CommandContext } from '../../src/types.js';

/**
 * A command context writing to a fresh temp dir, with a fixed date and a fake clock that ticks 1 ms per read. Call it
 * inside a test: the temp dir is removed when that test finishes.
 */
export function testContext(): CommandContext & { lines: string[] } {
  let t = 0;
  const lines: string[] = [];
  const outDir = mkdtempSync(join(tmpdir(), 'latentia-sim-'));
  onTestFinished(() => rmSync(outDir, { recursive: true, force: true }));
  return { outDir, date: '2026-01-02', now: () => t++, progress: (l) => lines.push(l), lines };
}

export const readOut = (ctx: CommandContext, file: string): string => readFileSync(join(ctx.outDir, file), 'utf8');

/** CSV text → rows of cells (RFC 4180 quoting: a quoted cell may hold commas and doubled quotes). */
export function csvRows(text: string): string[][] {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      const cells: string[] = [];
      let cell = '';
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i] as string;
        if (quoted && ch === '"' && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') quoted = !quoted;
        else if (ch === ',' && !quoted) {
          cells.push(cell);
          cell = '';
        } else cell += ch;
      }
      cells.push(cell);
      return cells;
    });
}
