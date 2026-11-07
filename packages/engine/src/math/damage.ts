import { assertSafe, idiv, mulBp } from './bp.js';
import { levelFactor } from './stats.js';

export interface PowerInput {
  base: number;
  additive: number;
  conditional: number[];
  toolSteps: number;
  summary: boolean;
}

/** Spec §5 step 1: base + additive, conditional multipliers, tool steps (11000 each), summary (5000). */
export function effectivePower(i: PowerInput): number {
  let p = assertSafe(i.base + i.additive, 'power base');
  for (const m of i.conditional) p = mulBp(p, m);
  for (let s = 0; s < i.toolSteps; s++) p = mulBp(p, 11000);
  if (i.summary) p = mulBp(p, 5000);
  return p;
}

export interface DamageMods {
  type?: number;
  t4se?: number;
  native?: number;
  crit?: number;
  roll?: number;
  handoff?: number;
  specialist?: number;
  overfit?: number;
  glazed?: number;
  observation?: number;
  guard?: number;
  refusalOrApology?: number;
}

/** Modifier application order is normative (spec §5 step 4). */
const MOD_ORDER = [
  'type',
  't4se',
  'native',
  'crit',
  'roll',
  'handoff',
  'specialist',
  'overfit',
  'glazed',
  'observation',
  'guard',
  'refusalOrApology',
] as const;

export interface DamageInput {
  /** Already-computed effective power (see effectivePower). */
  power: number;
  /** Effective attack. */
  atk: number;
  /** Effective defense. */
  def: number;
  level: number;
  mods: DamageMods;
}

export function computeDamage(i: DamageInput): number {
  const lf = levelFactor(i.level);
  const num = assertSafe(i.power * i.atk * lf * 10000, 'damage numerator');
  let d = idiv(num, assertSafe(i.def * 50, 'damage denominator'));
  for (const key of MOD_ORDER) {
    let m = i.mods[key];
    if (m === undefined) continue;
    if (key === 'type') m = Math.max(2500, Math.min(30000, m));
    d = mulBp(d, m);
  }
  return idiv(d, 10000) + 1;
}
