export interface TemperatureRow {
  readonly rollMinPct: number;
  readonly rollMaxPct: number;
  readonly accMod: number;
  readonly baseCritStage: number;
  readonly selfHallucinationPct: number;
  readonly wild: boolean;
}

function t(rollMinPct: number, rollMaxPct: number, accMod: number, baseCritStage: number, selfHallucinationPct: number, wild: boolean): TemperatureRow {
  return Object.freeze({ rollMinPct, rollMaxPct, accMod, baseCritStage, selfHallucinationPct, wild });
}

/** Indexed by temperature notch 0..4. Source: design bible temperature table. */
export const TEMPERATURE: readonly TemperatureRow[] = Object.freeze([
  t(100, 100, 10, 0, 0, false),
  t(95, 105, 5, 1, 0, false),
  t(85, 110, 0, 2, 0, false),
  t(75, 125, -5, 3, 5, true),
  t(60, 150, -10, 4, 12, true),
]);

const STATUS_HALLUCINATION_PCT = [12, 25, 25, 50, 50] as const;

/** Chance (percent) that an action hallucinates (spec §5 D2), capped at 100. */
export function hallucinationChancePct(temp: number, hasStatus: boolean): number {
  const row = TEMPERATURE[temp];
  const fromStatus = STATUS_HALLUCINATION_PCT[temp];
  if (row === undefined || fromStatus === undefined) throw new RangeError(`temperature out of range: ${String(temp)}`);
  return Math.min(100, (hasStatus ? fromStatus : 0) + row.selfHallucinationPct);
}
