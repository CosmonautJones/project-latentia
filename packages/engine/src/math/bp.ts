/**
 * Raised when an engine invariant is violated (unsafe integer, division by zero, ...), with the context
 * spec §7 asks for when known: round, `action` (the resolving entry's move id or lever kind), actor
 * (canonical index) and seed. Fields the raiser left unset are filled in by the round loop when the error
 * escapes an entry's resolution (Ruling 78).
 */
export class EngineInvariantError extends Error {
  round?: number;
  actor?: number;
  seed?: string;
  action?: string;

  constructor(message: string, ctx: { round?: number; actor?: number; seed?: string; action?: string } = {}) {
    super(message);
    this.name = 'EngineInvariantError';
    if (ctx.round !== undefined) this.round = ctx.round;
    if (ctx.actor !== undefined) this.actor = ctx.actor;
    if (ctx.seed !== undefined) this.seed = ctx.seed;
    if (ctx.action !== undefined) this.action = ctx.action;
  }
}

export const BP = 10000;

export function assertSafe(n: number, label: string): number {
  if (!Number.isSafeInteger(n)) {
    throw new EngineInvariantError(`${label} is not a safe integer: ${String(n)}`);
  }
  return n;
}

/** Floor division of safe integers. */
export function idiv(a: number, b: number): number {
  assertSafe(a, 'idiv dividend');
  assertSafe(b, 'idiv divisor');
  if (b === 0) throw new EngineInvariantError('idiv by zero');
  return assertSafe(Math.floor(a / b), 'idiv result');
}

/** floor(x * bp / 10000). */
export function mulBp(x: number, bp: number): number {
  return idiv(assertSafe(x * bp, 'mulBp product'), BP);
}

export const STAGE_BP = [5714, 6667, 8000, 10000, 12500, 15000, 17500] as const;

/** Basis points for a stat stage, clamped to -3..3. */
export function stageBp(stage: number): number {
  const s = Math.max(-3, Math.min(3, Math.trunc(stage)));
  return STAGE_BP[s + 3] as number;
}
