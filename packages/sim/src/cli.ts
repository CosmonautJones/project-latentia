import { fileURLToPath } from 'node:url';
import { UsageError } from './args.js';
import { fuzzCommand } from './commands/fuzz.js';
import { matchupCommand } from './commands/matchup.js';
import { roundRobinCommand } from './commands/round-robin.js';
import { targetsCommand } from './commands/targets.js';
import type { CommandContext } from './types.js';

// The CLI layer: the only place the sim reads the date and the wall clock (Ruling 126). Commands get them, the
// report directory (`reports/` at the repo root) and a stderr progress sink through a CommandContext.

/** A command's handler: its exit code (void is 0). */
export type Command = (args: string[]) => Promise<number | void> | number | void;

const REPORTS_DIR = fileURLToPath(new URL('../../../reports/', import.meta.url));

/** The real context: today's UTC date, performance.now, stderr. */
function cliContext(): CommandContext {
  return {
    outDir: REPORTS_DIR,
    date: new Date().toISOString().slice(0, 10),
    now: () => performance.now(),
    progress: (line) => process.stderr.write(`${line}\n`),
  };
}

/** Command name -> handler. C4 registers `search` here. */
export const commands: Record<string, Command> = {
  'round-robin': (args) => roundRobinCommand(args, cliContext()),
  matchup: (args) => matchupCommand(args, cliContext()),
  fuzz: (args) => fuzzCommand(args, cliContext()),
  targets: (args) => targetsCommand(args, cliContext()),
};

/**
 * Dispatches `argv` (command name first) and returns the exit code: the command's own, 1 for an unknown command,
 * 2 for a UsageError (its message is printed). No args prints usage and returns 0.
 */
export async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv;
  const run = name === undefined ? undefined : commands[name];
  if (run === undefined) {
    console.error(`usage: pnpm sim <command> [options]\ncommands: ${Object.keys(commands).join(', ') || '(none yet)'}`);
    return name === undefined ? 0 : 1;
  }
  try {
    return (await run(rest)) ?? 0;
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    console.error(`${name}: ${e.message}`);
    return 2;
  }
}
