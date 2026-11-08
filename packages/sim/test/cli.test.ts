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
  it('registers the round-robin, matchup, fuzz and targets commands', () => {
    expect(Object.keys(commands)).toEqual(expect.arrayContaining(['round-robin', 'matchup', 'fuzz', 'targets']));
  });
  it('prints usage and returns 1 for an unknown command', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await main(['nope'])).toBe(1);
    expect(err).toHaveBeenCalledOnce();
  });
  it('prints usage and returns 0 with no command', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await main([])).toBe(0);
    expect(err).toHaveBeenCalledOnce();
  });
});
