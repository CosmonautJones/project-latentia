import { assertSafe, idiv, mulBp, stageBp } from './bp.js';

/** HP = floor(2 * baseHP * L / 100) + L + 10 */
export function hpAt(baseHp: number, level: number): number {
  return assertSafe(idiv(2 * baseHp * level, 100) + level + 10, 'hpAt');
}

/** Stat = floor(2 * base * L / 100) + 5 */
export function statAt(base: number, level: number): number {
  return assertSafe(idiv(2 * base * level, 100) + 5, 'statAt');
}

/** floor(stat * stageBp / 10000) */
export function effectiveStat(stat: number, stage: number): number {
  return mulBp(stat, stageBp(stage));
}

/** LF = floor(2 * L / 5) + 2 */
export function levelFactor(level: number): number {
  return idiv(2 * level, 5) + 2;
}
