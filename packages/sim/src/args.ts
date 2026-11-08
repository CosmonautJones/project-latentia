// Command-line flags for the sim commands. A bad flag is a UsageError: the CLI prints it and exits 2.

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/** The value after `--name`, or undefined when the flag is absent. A flag with no value is a UsageError. */
function flagValue(args: readonly string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (v === undefined || v.startsWith('--')) throw new UsageError(`--${name} needs a value`);
  return v;
}

/** `--name N` as a positive integer, or `fallback` when absent. */
export function intFlag(args: readonly string[], name: string, fallback: number): number {
  const v = flagValue(args, name);
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!/^\d+$/.test(v) || !Number.isSafeInteger(n) || n < 1) throw new UsageError(`--${name} must be a positive integer, got ${v}`);
  return n;
}

/** `--name k` as a positive finite number, or `fallback` when absent. */
export function numFlag(args: readonly string[], name: string, fallback: number): number {
  const v = flagValue(args, name);
  if (v === undefined) return fallback;
  const n = Number(v);
  if (v.trim() === '' || !Number.isFinite(n) || n <= 0) throw new UsageError(`--${name} must be a positive number, got ${v}`);
  return n;
}

/** The arguments that are neither flags nor flag values (every flag takes one value). */
export function positionals(args: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (a.startsWith('--')) i++;
    else out.push(a);
  }
  return out;
}
