// Command-line parsing for the sim commands (Ruling 137). Each command declares its flags and how many positionals it
// takes; anything else — an unknown or misspelt flag, a flag given twice, a flag with no value, too many or too few
// positionals — is a UsageError, which the CLI prints and exits 2 on. Nothing is silently ignored, so a typo never
// launches a run at its defaults. Flags take one value, as `--name value` or `--name=value`. A bare `--` ends the
// flags: every argument after it is a positional.

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/**
 * `int`: a positive integer; `num`: a positive finite number; `tag` and `id`: lowercase letters, digits and dashes (a
 * file-name tag, an archetype id); `seed`: a seed, 32 lowercase hex characters, not all zero.
 */
export type FlagKind = 'int' | 'num' | 'tag' | 'id' | 'seed';
export type CommandSpec = {
  name: string;
  /** Positional names, in order (the command takes exactly these). */
  positionals: readonly string[];
  flags: Readonly<Record<string, FlagKind>>;
  /** Flags the command cannot run without (a missing one is a UsageError). */
  required?: readonly string[];
};
export type Parsed = { positionals: string[]; flags: ReadonlyMap<string, number | string> };

const PLACEHOLDER: Record<FlagKind, string> = { int: 'N', num: 'k', tag: '<tag>', id: '<id>', seed: '<hex>' };

/** One usage line: `name <pos>… --required <kind>… [--flag <kind>]…`. */
export function usageLine(spec: CommandSpec): string {
  const required = new Set(spec.required ?? []);
  const flag = ([f, k]: [string, FlagKind]): string => `--${f} ${PLACEHOLDER[k]}`;
  const entries = Object.entries(spec.flags);
  return [spec.name, ...spec.positionals.map((p) => `<${p}>`), ...entries.filter(([f]) => required.has(f)).map(flag), ...entries.filter(([f]) => !required.has(f)).map((e) => `[${flag(e)}]`)].join(' ');
}

function value(kind: FlagKind, name: string, v: string): number | string {
  if (kind === 'tag' || kind === 'id') {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) throw new UsageError(`--${name} must be lowercase letters, digits and dashes, got ${v}`);
    return v;
  }
  if (kind === 'seed') {
    if (!(/^[0-9a-f]{32}$/.test(v) && /[1-9a-f]/.test(v))) throw new UsageError(`--${name} must be 32 lowercase hex characters, not all zero, got ${v}`);
    return v;
  }
  const n = Number(v);
  if (kind === 'int' && !(/^\d+$/.test(v) && Number.isSafeInteger(n) && n >= 1)) throw new UsageError(`--${name} must be a positive integer, got ${v}`);
  if (kind === 'num' && !(v.trim() !== '' && Number.isFinite(n) && n > 0)) throw new UsageError(`--${name} must be a positive number, got ${v}`);
  return n;
}

export function parseArgs(args: readonly string[], spec: CommandSpec): Parsed {
  const usage = `usage: ${usageLine(spec)}`;
  const positionals: string[] = [];
  const flags = new Map<string, number | string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (a === '--') {
      positionals.push(...args.slice(i + 1));
      break;
    }
    if (!a.startsWith('--')) {
      positionals.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    const name = eq < 0 ? a.slice(2) : a.slice(2, eq);
    const kind = Object.prototype.hasOwnProperty.call(spec.flags, name) ? spec.flags[name] : undefined;
    if (kind === undefined) throw new UsageError(`unknown flag --${name}\n${usage}`);
    if (flags.has(name)) throw new UsageError(`--${name} given twice\n${usage}`);
    const v = eq < 0 ? args[++i] : a.slice(eq + 1);
    if (v === undefined || (eq < 0 && v.startsWith('--'))) throw new UsageError(`--${name} needs a value\n${usage}`);
    flags.set(name, value(kind, name, v));
  }
  if (positionals.length !== spec.positionals.length) {
    const what = positionals.length > spec.positionals.length ? `unexpected argument ${positionals[spec.positionals.length]}` : `missing <${spec.positionals[positionals.length]}>`;
    throw new UsageError(`${what}\n${usage}`);
  }
  const missing = (spec.required ?? []).find((f) => !flags.has(f));
  if (missing !== undefined) throw new UsageError(`missing --${missing}\n${usage}`);
  return { positionals, flags };
}

/** A numeric flag's value, or `fallback` when it was not given. */
export function num(p: Parsed, name: string, fallback: number): number {
  const v = p.flags.get(name);
  return typeof v === 'number' ? v : fallback;
}

/** A string flag's value (a tag, an id, a seed), or undefined when it was not given. */
export function tag(p: Parsed, name: string): string | undefined {
  const v = p.flags.get(name);
  return typeof v === 'string' ? v : undefined;
}
