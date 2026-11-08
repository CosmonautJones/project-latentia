import { fnv1a64Hex, simulate, type BattleSetup, type SeedHex } from '@latentia/engine';
import type { Archetype, MatchStats, Score } from './types.js';

const encoder = new TextEncoder();

/**
 * A deterministic seed for battle `i` of the run named `label`: two FNV-1a-64 halves (of `${label}:${i}` and
 * of the same text plus `#2`) make 32 lowercase hex characters; an all-zero result is nudged to end in 1.
 */
export function seedFor(label: string, i: number): SeedHex {
  const text = `${label}:${i}`;
  const hex = fnv1a64Hex(encoder.encode(text)) + fnv1a64Hex(encoder.encode(`${text}#2`));
  return /[1-9a-f]/.test(hex) ? hex : `${hex.slice(0, 31)}1`;
}

/**
 * `seeds` battles of `a` (side a) against `b` (side b), both on Autopilot, seeds `seedFor(label, 0..seeds-1)`.
 * Pure in its inputs: the same archetypes, count and label always give the same stats.
 *
 * Overwrites `side.opponentId` on copies: A faces `b.id` and B faces `a.id`, because the engine matches it
 * against `recordedFrom` / `recordedFoes` (Specialist, Robust). The archetypes themselves are not mutated.
 */
export function runMatch(a: Archetype, b: Archetype, seeds: number, label: string): MatchStats {
  const stats: MatchStats = { winsA: 0, winsB: 0, draws: 0, rounds: [] };
  const setup: BattleSetup = {
    a: { ...a.side, opponentId: b.id },
    b: { ...b.side, opponentId: a.id },
    kind: 'trainer',
  };
  for (let i = 0; i < seeds; i++) {
    const r = simulate(setup, seedFor(label, i), { kind: 'autopilot' });
    if (r.winner === 'a') stats.winsA++;
    else if (r.winner === 'b') stats.winsB++;
    else stats.draws++;
    stats.rounds.push(r.rounds);
  }
  return stats;
}

/** Side A's Score in a run: its wins plus half its draws. */
export const scoreA = (s: MatchStats): Score => ({ points: s.winsA + s.draws / 2, n: s.winsA + s.winsB + s.draws });
/** Side B's Score in a run. */
export const scoreB = (s: MatchStats): Score => ({ points: s.winsB + s.draws / 2, n: s.winsA + s.winsB + s.draws });

/**
 * `x` against `y` with both side assignments pooled: `perSide` battles with x on side a (label `<label>:ab`), then
 * `perSide` with x on side b (`<label>:ba`). Returns x's Score over all 2 × perSide battles and every round count.
 */
export function runPooled(x: Archetype, y: Archetype, perSide: number, label: string): { score: Score; rounds: number[] } {
  const ab = runMatch(x, y, perSide, `${label}:ab`);
  const ba = runMatch(y, x, perSide, `${label}:ba`);
  const a = scoreA(ab);
  const b = scoreB(ba);
  return { score: { points: a.points + b.points, n: a.n + b.n }, rounds: [...ab.rounds, ...ba.rounds] };
}
