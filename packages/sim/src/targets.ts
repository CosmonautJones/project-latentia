import { ARCHETYPES, mirrorOf } from './archetypes/index.js';
import { allRounds, fieldScore, roundRobin, worstPairing } from './round-robin.js';
import { runMatch, runPooled, scoreA } from './runner.js';
import { addScores, median, pointVerdict, rate, verdict, wilson95 } from './stats.js';
import { baseTeam, GRAFT_SPECIES, graftVariant, spinUpVariant, starterSide, temperaturePair, TRIANGLE } from './target-setups.js';
import { fmtCount } from './report.js';
import type { Score, Verdict } from './types.js';

// `TARGETS` — the bible's balance targets exactly as spec §9's table gives them — and `measureTargets`, which measures
// each with its own setup (target-setups.ts, Ruling 133) and its own seedFor label, so targets are independent and
// reproducible. Rates are side scores with a draw counted as 0.5; bands are fractions, except fight length (rounds).
// Besides each target's own rows (role `target`), a target may carry a `summary` row restating one of them (worst
// matchup's overall worst) and `diagnostic` rows (Ruling 143: the per-archetype temperature sweep; Ruling 147: graft
// vs spin-up). Only `target` rows count toward pass, fail and inconclusive, and toward the target's verdict.

export type TargetId = 'vs-field' | 'worst-matchup' | 'starter-triangle' | 'temperature-dial' | 'graft-vs-spin-up' | 'fight-length' | 'first-mover';

export type Target = {
  id: TargetId;
  name: string;
  setup: string;
  /** §9's seed count, as the table states it. */
  seeds: string;
  /** Inclusive pass band: fractions for rates, rounds for fight length. */
  band: readonly [number, number];
  bandText: string;
  /** Judged on the point estimate alone (pointVerdict): there is no interval. */
  pointOnly: boolean;
};

export const TARGETS: readonly Target[] = deepFrozen([
  { id: 'vs-field', name: 'Any archetype vs the field', setup: 'round-robin, pooled over all of the archetype’s battles', seeds: '1,000 per ordered pairing', band: [0, 0.55], bandText: '≤ 55%', pointOnly: false },
  { id: 'worst-matchup', name: 'Worst single matchup', setup: 'round-robin, per unordered pairing with both sides pooled', seeds: '2,000 per pairing', band: [0.3, 1], bandText: '≥ 30%', pointOnly: false },
  { id: 'starter-triangle', name: 'Starter triangle', setup: 'each starter alone (orchestrator only, role-based decks) vs its counter, both sides pooled', seeds: '2,000', band: [0.55, 0.65], bandText: '55–65% for the favoured side', pointOnly: false },
  { id: 'temperature-dial', name: 'Temperature dial', setup: 'always-T0 vs always-T4, same teams, both sides, every archetype pooled', seeds: '2,000', band: [0.45, 0.55], bandText: 'within 5 points of 50%', pointOnly: false },
  { id: 'graft-vs-spin-up', name: 'Graft worth taking', setup: 'base team + graft vs the same base team without it, same 3 species, both sides pooled (spin-up is intended to be stronger)', seeds: '2,000', band: [0.55, 1], bandText: '≥ 55% for the graft side', pointOnly: false },
  { id: 'fight-length', name: 'Fight length', setup: 'round-robin', seeds: 'all', band: [5, 8], bandText: 'median 5–8 rounds', pointOnly: true },
  { id: 'first-mover', name: 'First mover', setup: 'perfect mirror, side A vs side B', seeds: '10,000', band: [0.48, 0.52], bandText: '48–52%', pointOnly: false },
]);

function deepFrozen<T extends object>(xs: T[]): readonly T[] {
  const freeze = (v: unknown): void => {
    if (typeof v !== 'object' || v === null) return;
    for (const x of Object.values(v)) freeze(x);
    Object.freeze(v);
  };
  freeze(xs);
  return xs;
}

export const targetById = (id: TargetId): Target => TARGETS.find((t) => t.id === id) as Target;

/** `target`: counts toward the target's verdict; `summary`: restates a target row (not counted again); `diagnostic`: read only, never counted. */
export type RowRole = 'target' | 'summary' | 'diagnostic';
/**
 * One measured line of a target: a point (a rate, or rounds for fight length), its 95% interval unless point-only, and
 * its verdict against the band (for a diagnostic row, a reading only).
 */
export type TargetRow = { target: TargetId; role: RowRole; subject: string; battles: number; point: number; interval: [number, number] | null; verdict: Verdict };
/** One timed measurement (a round-robin serves three targets). */
export type Measurement = { name: string; targets: TargetId[]; battles: number; ms: number };
/** `seeds`: each target's seed counts as actually run at this scale (the §9 counts are TARGETS' `seeds`). */
export type TargetsRun = { scale: number; rows: TargetRow[]; measurements: Measurement[]; seeds: Record<TargetId, string> };

/** Battles per side assignment in the per-archetype temperature sweep (diagnostic rows, 500 per archetype at scale 1). */
export const TEMPERATURE_SWEEP_PER_SIDE = 250;

/** A §9 count under `--seeds-scale k`: n × k rounded up, at least 1 (a 1e-9 slack absorbs floating-point error). */
export function scaled(n: number, k: number): number {
  return Math.max(1, Math.ceil(n * k - 1e-9));
}

/** A target's overall verdict: its worst `target` row's (fail, then inconclusive, then pass); pass the verdicts of those rows only. */
export function targetVerdict(verdicts: readonly Verdict[]): Verdict {
  return verdicts.includes('fail') ? 'fail' : verdicts.includes('inconclusive') ? 'inconclusive' : 'pass';
}

/** A rate row: the Score's rate, its Wilson interval and the §9 verdict against the target's band. */
function rateRow(target: TargetId, subject: string, s: Score, role: RowRole = 'target'): TargetRow {
  const band = targetById(target).band as [number, number];
  const point = rate(s);
  const interval = wilson95(s.points, s.n);
  return { target, role, subject, battles: s.n, point, interval, verdict: verdict(point, interval, band) };
}

export type MeasureOptions = { scale: number; now: () => number; progress: (line: string) => void };

/**
 * Measures every target at `scale` × its §9 count. Two-sided targets run half their count with each side assignment;
 * vs field, worst matchup and fight length share one round-robin at 1,000 seeds per ordered pairing.
 */
export function measureTargets({ scale, now, progress }: MeasureOptions): TargetsRun {
  const n = (x: number): string => fmtCount(scaled(x, scale));
  const nArch = ARCHETYPES.length;
  const seeds: Record<TargetId, string> = {
    'vs-field': `${n(1000)} per ordered pairing`,
    'worst-matchup': `${fmtCount(2 * scaled(1000, scale))} per pairing`,
    'starter-triangle': `${fmtCount(2 * scaled(1000, scale))} per matchup`,
    'temperature-dial': `${fmtCount(2 * nArch * scaled(50, scale))} (${n(50)} per side × 2 sides × ${nArch} archetypes)`,
    'graft-vs-spin-up': `${fmtCount(2 * scaled(1000, scale))} per species`,
    'fight-length': 'all round-robin battles',
    'first-mover': `${fmtCount(nArch * scaled(500, scale))} (${n(500)} × ${nArch} archetypes)`,
  };
  const rows: TargetRow[] = [];
  const measurements: Measurement[] = [];
  const timed = (name: string, targets: TargetId[], run: () => number): void => {
    progress(`targets: ${name}…`);
    const t0 = now();
    const battles = run();
    measurements.push({ name, targets, battles, ms: now() - t0 });
  };

  timed('starter triangle', ['starter-triangle'], () => {
    let battles = 0;
    // Ruling 146: partnerless, on the seed labels triangle-solo has always used, so earlier numbers reproduce.
    for (const [fav, beaten] of TRIANGLE) {
      const { score } = runPooled(starterSide(fav), starterSide(beaten), scaled(1000, scale), `triangle-solo:${fav}:${beaten}`);
      rows.push(rateRow('starter-triangle', `${fav} (favoured) vs ${beaten}`, score));
      battles += score.n;
    }
    return battles;
  });

  timed('temperature dial', ['temperature-dial'], () => {
    // Ruling 143 I2: every archetype at T0 against its own mirror at T4, both sides, pooled (as first mover is).
    const pooled = ARCHETYPES.map((x) => runPooled(...temperaturePair(x), scaled(50, scale), `targets:temperature-dial:${x.id}`).score);
    rows.push(rateRow('temperature-dial', 'T0 side vs its T4 mirror, every archetype pooled', addScores(...pooled)));
    // Diagnostic: the per-archetype sweep, on its own seeds and more of them.
    let battles = pooled.reduce((t, s) => t + s.n, 0);
    for (const x of ARCHETYPES) {
      const { score } = runPooled(...temperaturePair(x), scaled(TEMPERATURE_SWEEP_PER_SIDE, scale), `targets:temperature-sweep:${x.id}`);
      rows.push(rateRow('temperature-dial', `sweep: ${x.id} (own T${x.side.autopilot?.temperature}), T0 vs T4 mirror`, score, 'diagnostic'));
      battles += score.n;
    }
    return battles;
  });

  timed('graft worth taking', ['graft-vs-spin-up'], () => {
    let battles = 0;
    for (const species of GRAFT_SPECIES) {
      const { score } = runPooled(graftVariant(species), baseTeam(), scaled(1000, scale), `targets:graft-worth-taking:${species}`);
      rows.push(rateRow('graft-vs-spin-up', `${species}: base team + graft vs base team alone`, score));
      battles += score.n;
    }
    // Diagnostic (Ruling 147): the old G-vs-S rows, S being the spun-up subagent at L5 with 1 active card and no signature.
    // Spin-up is intended to be stronger, so these read low against the "worth taking" band by design.
    for (const species of GRAFT_SPECIES) {
      const { score } = runPooled(graftVariant(species), spinUpVariant(species), scaled(1000, scale), `targets:graft-vs-spin-up:${species}`);
      rows.push(rateRow('graft-vs-spin-up', `diagnostic: ${species}: graft (G) vs spin-up (S)`, score, 'diagnostic'));
      battles += score.n;
    }
    return battles;
  });

  timed('first mover', ['first-mover'], () => {
    const per = scaled(500, scale);
    const score = addScores(...ARCHETYPES.map((x) => scoreA(runMatch(x, mirrorOf(x, 'm'), per, `targets:first-mover:${x.id}`))));
    rows.push(rateRow('first-mover', 'side A vs its mirror, every archetype pooled', score));
    return score.n;
  });

  timed('round-robin', ['vs-field', 'worst-matchup', 'fight-length'], () => {
    const rr = roundRobin(ARCHETYPES, scaled(1000, scale), 'targets:round-robin', (done, total) => progress(`targets: round-robin ${done}/${total} archetypes`));
    for (const id of rr.ids) rows.push(rateRow('vs-field', id, fieldScore(rr, id)));
    const worst = rr.ids.map((id) => ({ id, ...worstPairing(rr, id) }));
    for (const w of worst) rows.push(rateRow('worst-matchup', `${w.id} vs ${w.foe}`, w.score));
    const overall = worst.reduce((a, b) => (rate(b.score) < rate(a.score) ? b : a));
    rows.push(rateRow('worst-matchup', `overall: ${overall.id} vs ${overall.foe}`, overall.score, 'summary'));
    const rounds = allRounds(rr);
    const m = median(rounds);
    rows.push({ target: 'fight-length', role: 'target', subject: 'median rounds, all round-robin battles', battles: rounds.length, point: m, interval: null, verdict: pointVerdict(m, targetById('fight-length').band as [number, number]) });
    return rounds.length;
  });

  // Rows in §9 table order, each target's rows in measurement order.
  const order = TARGETS.map((t) => t.id);
  rows.sort((a, b) => order.indexOf(a.target) - order.indexOf(b.target));
  return { scale, rows, measurements, seeds };
}
