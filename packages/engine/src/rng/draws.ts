import { EngineInvariantError } from '../math/bp.js';
import { nextU32, type RngState } from './sfc32.js';

/** A draw half is reduced by a modulus that is a safe integer in 1..65536 (spec §5); anything else is an engine bug. */
function modulus(m: number): number {
  if (!Number.isSafeInteger(m) || m < 1 || m > 65536) {
    throw new EngineInvariantError(`draw modulus must be an integer in 1..65536, got ${String(m)}`);
  }
  return m;
}

/** Low 16 bits of `d` modulo `a` (1 <= a <= 65536). */
export function lo(d: number, a: number): number {
  return (d & 0xffff) % modulus(a);
}

/** High 16 bits of `d` modulo `b` (1 <= b <= 65536). */
export function hi(d: number, b: number): number {
  return (d >>> 16) % modulus(b);
}

export type ActionDraws = { d1: number; d2: number; d3: number; d4: number; d5: number; d6: number };

/** Exactly six draws per action, whether or not the actor acts. */
export function drawAction(s: RngState): ActionDraws {
  const d1 = nextU32(s);
  const d2 = nextU32(s);
  const d3 = nextU32(s);
  const d4 = nextU32(s);
  const d5 = nextU32(s);
  const d6 = nextU32(s);
  return { d1, d2, d3, d4, d5, d6 };
}

export type RoundStartDraws = { r1: number; r2: number };

/** Exactly two draws per creature at round start. */
export function drawRoundStart(s: RngState): RoundStartDraws {
  const r1 = nextU32(s);
  const r2 = nextU32(s);
  return { r1, r2 };
}
