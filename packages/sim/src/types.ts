import type { SideSetup } from '@latentia/engine';

/** A named team, grid and Autopilot deck the simulator can put on either side of a battle. */
export type Archetype = { id: string; side: SideSetup };

/**
 * Tallies of a run of seeded battles, from side A's point of view. `rounds[i]` is the length of battle i; `capHits`
 * counts the battles the round cap ended (BattleEnd reason `cap`, not merely a 50-round battle).
 */
export type MatchStats = { winsA: number; winsB: number; draws: number; rounds: number[]; capHits: number };

export type Verdict = 'pass' | 'fail' | 'inconclusive';

/** Points scored (a win is 1, a draw 0.5) out of `n` battles, from one archetype's point of view. */
export type Score = { points: number; n: number };

/**
 * What a command gets from the CLI layer (Ruling 126: the date and the wall clock come only from there): where to write
 * reports, the report date (YYYY-MM-DD), a millisecond clock for wall times, and a sink for progress lines (stderr).
 * Tests inject a temp dir, a fixed date and a fake clock.
 */
export type CommandContext = { outDir: string; date: string; now: () => number; progress: (line: string) => void };
