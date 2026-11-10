import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { usageLine, UsageError } from './args.js';
import { FUZZ, fuzzCommand } from './commands/fuzz.js';
import { MATCHUP, matchupCommand } from './commands/matchup.js';
import { ROUND_ROBIN, roundRobinCommand } from './commands/round-robin.js';
import { SEARCH, searchCommand } from './commands/search.js';
import { TARGETS_COMMAND, targetsCommand } from './commands/targets.js';
import { contentFingerprint } from './fingerprint.js';
import type { GitRevision } from './report.js';
import type { CommandContext } from './types.js';

// The CLI layer: the only place the sim reads the date, the wall clock and git (Rulings 126, 143 I5). Commands get
// them, the report directory (`reports/` at the repo root), a stderr progress sink and the reports' provenance
// through a CommandContext.

/** A command's handler: its exit code (void is 0). */
export type Command = (args: string[]) => Promise<number | void> | number | void;

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const REPORTS_DIR = fileURLToPath(new URL('../../../reports/', import.meta.url));

/**
 * The checked-out commit, and whether anything outside reports/ differs from it (modified, staged or untracked, but not
 * ignored): reports/ is excluded because a run writes there. Null when git is unavailable.
 */
export function gitRevision(cwd: string = REPO_ROOT): GitRevision {
  const git = (...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    return { sha: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain', '--', '.', ':(exclude)reports') !== '' };
  } catch {
    return null;
  }
}

/** The real context: today's UTC date, performance.now, stderr, and the provenance (read once per command). */
function cliContext(): CommandContext {
  return {
    outDir: REPORTS_DIR,
    date: new Date().toISOString().slice(0, 10),
    now: () => performance.now(),
    progress: (line) => process.stderr.write(`${line}\n`),
    provenance: { fingerprint: contentFingerprint(), git: gitRevision() },
  };
}

/** Command name -> handler. */
export const commands: Record<string, Command> = {
  'round-robin': (args) => roundRobinCommand(args, cliContext()),
  matchup: (args) => matchupCommand(args, cliContext()),
  fuzz: (args) => fuzzCommand(args, cliContext()),
  targets: (args) => targetsCommand(args, cliContext()),
  search: (args) => searchCommand(args, cliContext()),
};

/** The usage text: every command with its arguments, and where reports go. */
export function usage(): string {
  return [
    'usage: pnpm sim <command> [options]',
    ...[ROUND_ROBIN, MATCHUP, FUZZ, TARGETS_COMMAND, SEARCH].map((spec) => `  ${usageLine(spec)}`),
    ...Object.keys(commands)
      .filter((c) => ![ROUND_ROBIN, MATCHUP, FUZZ, TARGETS_COMMAND, SEARCH].some((s) => s.name === c))
      .map((c) => `  ${c}`),
    'Each run writes reports/<command>-<YYYY-MM-DD>[-<tag>].md and .csv at the repo root; a rerun on the same day overwrites them.',
    'reports/ is committed (Phase C5): use --tag scratch (any tag containing "scratch") for runs that stay git-ignored (reports/*scratch*).',
    'Unknown flags and extra arguments are errors (exit 2).',
  ].join('\n');
}

/**
 * Dispatches `argv` (command name first; one leading `--`, which pnpm forwards from `pnpm sim -- <command>`, is
 * dropped) and returns the exit code: the command's own, 1 for an unknown command, 2 for a UsageError (its message
 * is printed). No args prints usage and returns 0.
 */
export async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv[0] === '--' ? argv.slice(1) : argv;
  const run = name === undefined || !Object.hasOwn(commands, name) ? undefined : commands[name];
  if (run === undefined) {
    console.error(name === undefined ? usage() : `unknown command ${name}\n${usage()}`);
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
