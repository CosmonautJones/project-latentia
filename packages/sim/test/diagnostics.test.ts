import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// scripts/diagnostics.ts parses its arguments like the sim commands do: anything unknown is a usage error, exit code 2.

const run = (...args: string[]) => spawnSync('pnpm', ['exec', 'tsx', 'scripts/diagnostics.ts', ...args], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

describe('diagnostics script arguments', () => {
  it.each([[['bogus']], [[]], [['temp', 'extra']], [['temp', '--nope']], [['temp', '--seeds']], [['temp', '--seeds', '0']], [['--seeds', '2', '--seeds', '3', 'temp']]])('rejects %j with exit code 2 and no report', (args) => {
    const r = run(...args);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).not.toBe('');
  }, 60_000);
  it('accepts --seeds N as the battles per side assignment', () => {
    const r = run('temp', '--seeds', '1');
    expect(r.status).toBe(0);
    const rows = r.stdout.split('\n').filter((l) => l.startsWith('| ') && l.includes('(own T'));
    expect(rows.length).toBeGreaterThanOrEqual(20);
    for (const l of rows) expect(l.split('|')[2]?.trim()).toBe('2');
  }, 120_000);
});
