import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsageError } from '../src/args.js';
import { commands, main } from '../src/cli.js';

afterEach(() => {
  vi.restoreAllMocks();
  delete commands['hello'];
});

describe('main', () => {
  it('dispatches to a registered command with the remaining args and returns 0', async () => {
    const run = vi.fn();
    commands['hello'] = run;
    expect(await main(['hello', '--seeds', '5'])).toBe(0);
    expect(run).toHaveBeenCalledWith(['--seeds', '5']);
  });
  it("returns the command's exit code", async () => {
    commands['hello'] = () => 3;
    expect(await main(['hello'])).toBe(3);
  });
  it('prints a UsageError and returns 2', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    commands['hello'] = () => {
      throw new UsageError('--seeds must be a positive integer');
    };
    expect(await main(['hello'])).toBe(2);
    expect(err).toHaveBeenCalledWith('hello: --seeds must be a positive integer');
  });
  it('registers the round-robin, matchup, fuzz, targets and search commands', () => {
    expect(Object.keys(commands)).toEqual(expect.arrayContaining(['round-robin', 'matchup', 'fuzz', 'targets', 'search']));
  });
  it.each([
    [['round-robin', '--seed', '10'], /unknown flag --seed/],
    [['round-robin', '1000'], /unexpected argument 1000/],
    [['targets', '--seed-scale', '0.05'], /unknown flag --seed-scale/],
    [['targets', '--seeds-scale'], /--seeds-scale needs a value/],
    [['fuzz', '--battle', '5'], /unknown flag --battle/],
    [['fuzz', '--battles', '5', 'extra'], /unexpected argument extra/],
    [['matchup', 'speed-rush-blitzr', 'code-lock-cobolt', 'mixed-starter-sagelet'], /unexpected argument mixed-starter-sagelet/],
    [['matchup', 'speed-rush-blitzr', '--seeds', '5'], /missing <b>/],
    [['targets', '--', '--seeds-scale', '0.05'], /unexpected argument --seeds-scale/],
    [['search', '--archetype', 'speed-rush-blitzr', '--budget', '2000', '--seeds', '5'], /unknown flag --seeds/],
    [['search', '--archetype', 'speed-rush-blitzr'], /missing --budget/],
  ])('rejects %j before running anything: exit 2 with the reason and usage', async (argv, reason) => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await main(argv)).toBe(2);
    expect(err).toHaveBeenCalledOnce();
    expect(String(err.mock.calls[0]?.[0])).toMatch(reason);
    expect(String(err.mock.calls[0]?.[0])).toMatch(/usage: /);
  });
  it('drops one leading -- (pnpm forwards it: `pnpm sim -- <command>`)', async () => {
    const run = vi.fn();
    commands['hello'] = run;
    expect(await main(['--', 'hello', '--x'])).toBe(0);
    expect(run).toHaveBeenCalledWith(['--x']);
  });
  it('usage lists every command with its flags, where reports go, that same-day runs overwrite, and scratch tags', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await main([]);
    const text = String(err.mock.calls[0]?.[0]);
    for (const line of ['round-robin [--seeds N] [--tag <tag>]', 'matchup <a> <b> [--seeds N] [--tag <tag>]', 'fuzz [--battles N] [--tag <tag>]', 'targets [--seeds-scale k] [--tag <tag>]', 'search --archetype <id> --budget N [--seed <hex>] [--tag <tag>]']) expect(text).toContain(line);
    expect(text).toContain('reports/<command>-<YYYY-MM-DD>[-<tag>].md');
    expect(text).toMatch(/same day overwrites/);
    expect(text).toMatch(/--tag scratch.*git-ignored/s);
  });
  it('prints usage and returns 1 for an unknown command, including Object.prototype names', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await main(['toString'])).toBe(1);
    err.mockClear();
    expect(await main(['nope'])).toBe(1);
    expect(err).toHaveBeenCalledOnce();
  });
  it('prints usage and returns 0 with no command', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await main([])).toBe(0);
    expect(err).toHaveBeenCalledOnce();
  });
});
