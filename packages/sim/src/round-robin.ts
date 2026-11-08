import { runMatch, scoreA, scoreB } from './runner.js';
import { addScores, rate } from './stats.js';
import type { Archetype, MatchStats, Score } from './types.js';

// The round-robin (spec §9): every archetype against every other, each unordered pairing run with both side
// assignments — 20 archetypes → 190 unordered pairings → 380 ordered pairings — and the scores read off it.

export type OrderedPairing = { a: string; b: string; stats: MatchStats };
export type RoundRobin = { ids: string[]; seeds: number; ordered: OrderedPairing[] };

/**
 * `seeds` battles per ordered pairing, `a` on side a, seeded `seedFor(<label>:<a id>:<b id>, i)`, in archetype order
 * (all of the first archetype's pairings as side a, then the second's). `onArchetype(done, total)` is called after each
 * archetype's pairings as side a (for progress lines).
 */
export function roundRobin(archetypes: readonly Archetype[], seeds: number, label: string, onArchetype?: (done: number, total: number) => void): RoundRobin {
  const ordered: OrderedPairing[] = [];
  archetypes.forEach((a, i) => {
    for (const b of archetypes) if (b !== a) ordered.push({ a: a.id, b: b.id, stats: runMatch(a, b, seeds, `${label}:${a.id}:${b.id}`) });
    onArchetype?.(i + 1, archetypes.length);
  });
  return { ids: archetypes.map((a) => a.id), seeds, ordered };
}

/** `x`'s Score in one ordered pairing (whichever side it played). */
function scoreIn(p: OrderedPairing, x: string): Score {
  return p.a === x ? scoreA(p.stats) : scoreB(p.stats);
}

/** `x`'s Score against `y` with both orderings pooled. */
export function pairingScore(rr: RoundRobin, x: string, y: string): Score {
  return addScores(...rr.ordered.filter((p) => (p.a === x && p.b === y) || (p.a === y && p.b === x)).map((p) => scoreIn(p, x)));
}

/** `x`'s Score over every battle it played (vs the field). */
export function fieldScore(rr: RoundRobin, x: string): Score {
  return addScores(...rr.ordered.filter((p) => p.a === x || p.b === x).map((p) => scoreIn(p, x)));
}

/** Every unordered pairing once, in archetype order. */
export function unorderedPairings(rr: RoundRobin): [string, string][] {
  return rr.ids.flatMap((x, i) => rr.ids.slice(i + 1).map((y): [string, string] => [x, y]));
}

/** The foe `x` scores worst against (pooled over both orderings); ties go to the first foe in archetype order. */
export function worstPairing(rr: RoundRobin, x: string): { foe: string; score: Score } {
  let worst: { foe: string; score: Score } | null = null;
  for (const y of rr.ids) {
    if (y === x) continue;
    const score = pairingScore(rr, x, y);
    if (worst === null || rate(score) < rate(worst.score)) worst = { foe: y, score };
  }
  if (worst === null) throw new RangeError('a round-robin needs at least two archetypes');
  return worst;
}

/** Every battle's round count, pairing by pairing. */
export function allRounds(rr: RoundRobin): number[] {
  return rr.ordered.flatMap((p) => p.stats.rounds);
}
