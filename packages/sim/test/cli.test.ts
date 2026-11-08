import { afterEach, describe, expect, it, vi } from 'vitest';
import { commands, main } from '../src/cli.js';

afterEach(() => {
  vi.restoreAllMocks();
  for (const k of Object.keys(commands)) delete commands[k];
});

describe('main', () => {
  it('dispatches to a registered command with the remaining args and returns 0', async () => {
    const run = vi.fn();
    commands['hello'] = run;
    expect(await main(['hello', '--seeds', '5'])).toBe(0);
    expect(run).toHaveBeenCalledWith(['--seeds', '5']);
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
