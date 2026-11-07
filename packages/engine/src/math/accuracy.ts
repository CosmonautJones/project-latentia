import { assertSafe } from './bp.js';

export interface HitChanceInput {
  moveAcc: number;
  tempMod: number;
  drift: number;
  accStages: number;
  evaStages: number;
  robustBonus: number;
}

/** clamp(MoveAcc + TempMod - 8*Drift + 10*(Acc - Eva), 30, 100); robust bonus (+5) applies before the clamp. */
export function hitChance(i: HitChanceInput): number {
  const raw = assertSafe(
    i.moveAcc + i.tempMod - 8 * i.drift + 10 * (i.accStages - i.evaStages) + i.robustBonus,
    'hitChance',
  );
  return Math.max(30, Math.min(100, raw));
}

/** Crit thresholds out of 48 by crit stage 0..6. */
export const CRIT_THRESHOLDS_48 = [0, 1, 2, 4, 8, 24, 48] as const;

export function critThreshold(stage: number): number {
  const s = Math.max(0, Math.min(6, Math.trunc(stage)));
  return CRIT_THRESHOLDS_48[s] as number;
}
