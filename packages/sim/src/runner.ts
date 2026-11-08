import { fnv1a64Hex, simulate, type SeedHex } from '@latentia/engine';
import type { Archetype, MatchStats } from './types.js';

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
 */
export function runMatch(a: Archetype, b: Archetype, seeds: number, label: string): MatchStats {
  const stats: MatchStats = { winsA: 0, winsB: 0, draws: 0, rounds: [] };
  for (let i = 0; i < seeds; i++) {
    const r = simulate({ a: a.side, b: b.side, kind: 'trainer' }, seedFor(label, i), { kind: 'autopilot' });
    if (r.winner === 'a') stats.winsA++;
    else if (r.winner === 'b') stats.winsB++;
    else stats.draws++;
    stats.rounds.push(r.rounds);
  }
  return stats;
}
