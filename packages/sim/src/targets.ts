import { ARCHETYPES, mirrorOf } from './archetypes/index.js';
import { allRounds, fieldScore, roundRobin, worstPairing } from './round-robin.js';
import { runMatch, runPooled, scoreA } from './runner.js';
import { addScores, median, pointVerdict, rate, verdict, wilson95 } from './stats.js';
import { GRAFT_SPECIES, graftVariant, spinUpVariant, starterSide, temperatureSides, TRIANGLE } from './target-setups.js';
import type { Score, Verdict } from './types.js';

// `TARGETS` — the bible's balance targets exactly as spec §9's table gives them — and `measureTargets`, which measures
// each with its own setup (target-setups.ts, Ruling 133) and its own seedFor label, so targets are independent and
// reproducible. Rates are side scores with a draw counted as 0.5; bands are fractions, except fight length (rounds).

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
  { id: 'starter-triangle', name: 'Starter triangle', setup: 'each starter vs its counter, both sides, slice-level teams', seeds: '2,000', band: [0.55, 0.65], bandText: '55–65% for the favoured side', pointOnly: false },
  { id: 'temperature-dial', name: 'Temperature dial', setup: 'always-T0 vs always-T4, same teams, both sides', seeds: '2,000', band: [0.45, 0.55], bandText: 'within 5 points of 50%', pointOnly: false },
  { id: 'graft-vs-spin-up', name: 'Graft vs spin-up', setup: 'mirror teams differing only in that choice', seeds: '2,000', band: [0.45, 0.55], bandText: '45–55%', pointOnly: false },
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

/** One measured line of a target: a point (a rate, or rounds for fight length), its 95% interval unless point-only, and a verdict. */
export type TargetRow = { target: TargetId; subject: string; battles: number; point: number; interval: [number, number] | null; verdict: Verdict };
/** One timed measurement (a round-robin serves three targets). */
export type Measurement = { name: string; targets: TargetId[]; battles: number; ms: number };
export type TargetsRun = { scale: number; rows: TargetRow[]; measurements: Measurement[] };

/** A §9 count under `--seeds-scale k`: n × k rounded up, at least 1 (a 1e-9 slack absorbs floating-point error). */
export function scaled(n: number, k: number): number {
  return Math.max(1, Math.ceil(n * k - 1e-9));
}

/** A target's overall verdict: its worst row (fail, then inconclusive, then pass). */
export function targetVerdict(verdicts: readonly Verdict[]): Verdict {
  return verdicts.includes('fail') ? 'fail' : verdicts.includes('inconclusive') ? 'inconclusive' : 'pass';
}

/** A rate row: the Score's rate, its Wilson interval and the §9 verdict against the target's band. */
function rateRow(target: TargetId, subject: string, s: Score): TargetRow {
  const band = targetById(target).band as [number, number];
  const point = rate(s);
  const interval = wilson95(s.points, s.n);
  return { target, subject, battles: s.n, point, interval, verdict: verdict(point, interval, band) };
}

export type MeasureOptions = { scale: number; now: () => number; progress: (line: string) => void };

/**
 * Measures every target at `scale` × its §9 count. Two-sided targets run half their count with each side assignment;
 * vs field, worst matchup and fight length share one round-robin at 1,000 seeds per ordered pairing.
 */
export function measureTargets({ scale, now, progress }: MeasureOptions): TargetsRun {
  const rows: TargetRow[] = [];
  const measurements: Measurement[] = [];
  const timed = (name: string, targets: TargetId[], run: () => number): void => {
    progress(`targets: ${name}…`);
    const t0 = now();
    const battles = run();
    measurements.push({ name, targets, battles, ms: now() - t0 });
  };

  timed('starter triangle', ['starter-triangle'], () => {
    let n = 0;
    for (const [fav, beaten] of TRIANGLE) {
      const { score } = runPooled(starterSide(fav), starterSide(beaten), scaled(1000, scale), `targets:starter-triangle:${fav}:${beaten}`);
      rows.push(rateRow('starter-triangle', `${fav} (favoured) vs ${beaten}`, score));
      n += score.n;
    }
    return n;
  });

  timed('temperature dial', ['temperature-dial'], () => {
    const [t0, t4] = temperatureSides();
    const { score } = runPooled(t0, t4, scaled(1000, scale), 'targets:temperature-dial');
    rows.push(rateRow('temperature-dial', `${t0.id}: T0 side vs T4 mirror`, score));
    return score.n;
  });

  timed('graft vs spin-up', ['graft-vs-spin-up'], () => {
    let n = 0;
    for (const species of GRAFT_SPECIES) {
      const { score } = runPooled(graftVariant(species), spinUpVariant(species), scaled(1000, scale), `targets:graft-vs-spin-up:${species}`);
      rows.push(rateRow('graft-vs-spin-up', `${species}: graft (G) vs spin-up (S)`, score));
      n += score.n;
    }
    return n;
  });

  timed('first mover', ['first-mover'], () => {
    const per = scaled(500, scale);
    const score = addScores(...ARCHETYPES.map((x) => scoreA(runMatch(x, mirrorOf(x, 'm'), per, `targets:first-mover:${x.id}`))));
    rows.push(rateRow('first-mover', `side A, ${ARCHETYPES.length} archetypes × ${per} mirrors`, score));
    return score.n;
  });

  timed('round-robin', ['vs-field', 'worst-matchup', 'fight-length'], () => {
    const rr = roundRobin(ARCHETYPES, scaled(1000, scale), 'targets:round-robin', (done, total) => progress(`targets: round-robin ${done}/${total} archetypes`));
    for (const id of rr.ids) rows.push(rateRow('vs-field', id, fieldScore(rr, id)));
    const worst = rr.ids.map((id) => ({ id, ...worstPairing(rr, id) }));
    for (const w of worst) rows.push(rateRow('worst-matchup', `${w.id} vs ${w.foe}`, w.score));
    const overall = worst.reduce((a, b) => (rate(b.score) < rate(a.score) ? b : a));
    rows.push(rateRow('worst-matchup', `overall: ${overall.id} vs ${overall.foe}`, overall.score));
    const rounds = allRounds(rr);
    const m = median(rounds);
    rows.push({ target: 'fight-length', subject: 'median rounds, all round-robin battles', battles: rounds.length, point: m, interval: null, verdict: pointVerdict(m, targetById('fight-length').band as [number, number]) });
    return rounds.length;
  });

  // Rows in §9 table order, each target's rows in measurement order.
  const order = TARGETS.map((t) => t.id);
  rows.sort((a, b) => order.indexOf(a.target) - order.indexOf(b.target));
  return { scale, rows, measurements };
}
