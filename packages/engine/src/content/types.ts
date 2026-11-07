import { mulBp } from '../math/bp.js';
import type { TypeId } from './ids.js';

const X = 20000;
const H = 5000;
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

export const TYPE_MULT_MIN_BP = 2500;
export const TYPE_MULT_MAX_BP = 30000;

/** Product over the defender's types in basis points, clamped to 2500..30000. */
export function typeMultiplierBp(atk: TypeId, defTypes: readonly TypeId[]): number {
  let m = N;
  for (const d of defTypes) m = mulBp(m, TYPE_CHART_BP[atk][d]);
  return Math.max(TYPE_MULT_MIN_BP, Math.min(TYPE_MULT_MAX_BP, m));
}
