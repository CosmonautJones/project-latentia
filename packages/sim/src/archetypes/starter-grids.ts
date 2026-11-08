import type { GridLayout } from '@latentia/engine';
import { layout, type LegendEntry } from './build.js';

// The standard starter grids (Ruling 124): the only definition. C3's starter-triangle and graft-vs-spin-up setups
// build on it; the mixed-starter archetypes reuse its Skills (STARTER_SKILLS) on a two-slot grid (Ruling 130).

export type StarterId = 'sagelet' | 'blitzr' | 'forkling';

/**
 * The 5×5 loadout every starter shares (bible "Grid growth": at L7 "two active subagents become viable", but a
 * starter at L8 runs its one intern): the System Prompt, one Subagent Slot (`A`) with three Example Cards touching
 * it, the starter's three non-signature moves as Skills, and one Tool touching Skills `K` and `M`. 17 cells,
 * headroom 8 at 5×5. The slot's 2×2 at (0,1) can hold an L-shaped graft in its place (graft-vs-spin-up).
 */
const ROWS = [
  'PPP..', //
  'AAe..',
  'AAe..',
  'eKKt.',
  'LLMM.',
];

/** Skill letters per starter: K and M take the Tool's step (damage power or heal percentage); L does not. */
export const STARTER_SKILLS: Readonly<Record<StarterId, { K: string; M: string; L: string }>> = {
  sagelet: { K: 'chain-of-thought', M: 'proof-by-contradiction', L: 'step-back-prompt' },
  blitzr: { K: 'distilled-strike', M: 'token-burst', L: 'low-latency' },
  forkling: { K: 'leaderboard-flex', M: 'community-patch', L: 'swarm-of-fine-tunes' },
};

/** [minimum level, width, height] from L7 up: the engine's grid-size table (spec §5 "Grid model"). */
const SIZES: readonly (readonly [number, number, number])[] = [
  [7, 5, 5],
  [10, 6, 5],
  [13, 6, 6],
];

/**
 * The standard grid of a starter at `level` (7 or more), with its Subagent Slot bound to the creature `subagentId`.
 * The loadout is the same at every level; a larger grid only adds empty cells (headroom). Below L7 the grid is 5×4
 * or smaller and cannot hold it: RangeError. Compaction order: Skill L, M, K, then the slot.
 */
export function starterGrid(species: StarterId, level: number, subagentId: string): GridLayout {
  const size = SIZES.filter(([min]) => min <= level).at(-1);
  if (size === undefined) throw new RangeError(`a starter grid needs level 7 or more, got ${level}`);
  const [, width, height] = size;
  const rows = Array.from({ length: height }, (_, y) => (ROWS[y] ?? '').padEnd(width, '.'));
  const s = STARTER_SKILLS[species];
  const legend: Record<string, LegendEntry> = { L: { skill: s.L }, M: { skill: s.M }, K: { skill: s.K }, A: { slot: subagentId } };
  return layout(rows, legend);
}
