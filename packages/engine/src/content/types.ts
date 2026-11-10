import { mulBp } from '../math/bp.js';
import type { TypeId } from './ids.js';

/** Super-effective 1.5x and resisted 2/3 (Ruling 148; was 2x and 1/2). */
const X = 15000;
const H = 6667;
const N = 10000;

function row(rea: number, spd: number, opn: number, cod: number, vis: number, voi: number, sea: number, mem: number) {
  return Object.freeze({ reasoning: rea, speed: spd, open: opn, code: cod, vision: vis, voice: voi, search: sea, memory: mem });
}

/** Attacker row, defender column, basis points. Source: design bible type chart. */
export const TYPE_CHART_BP: Readonly<Record<TypeId, Readonly<Record<TypeId, number>>>> = Object.freeze({
  reasoning: row(N, H, X, X, N, N, N, H),
  speed: row(X, N, H, N, H, N, X, N),
  open: row(H, X, N, N, H, X, N, N),
  code: row(H, N, N, N, X, N, H, X),
  vision: row(N, X, X, H, N, H, N, N),
  voice: row(N, N, H, N, X, N, X, H),
  search: row(N, H, N, X, N, H, N, X),
  memory: row(X, N, N, H, N, X, H, N),
});

/**
 * Exact extremes of a dual-type product. `mulBp` floors: 6667 x 6667 = 4444.8889 -> 4444 (two resistances),
 * 15000 x 15000 = 22500 (two weaknesses). The clamp is a safety net that no chart product reaches, and
 * `test/content/types.test.ts` pins both bounds against the whole chart.
 */
export const TYPE_MULT_MIN_BP = 4444;
export const TYPE_MULT_MAX_BP = 22500;

/** Product over the defender's types in basis points (floored per `mulBp`), clamped to TYPE_MULT_MIN_BP..TYPE_MULT_MAX_BP. */
export function typeMultiplierBp(atk: TypeId, defTypes: readonly TypeId[]): number {
  let m = N;
  for (const d of defTypes) m = mulBp(m, TYPE_CHART_BP[atk][d]);
  return Math.max(TYPE_MULT_MIN_BP, Math.min(TYPE_MULT_MAX_BP, m));
}
