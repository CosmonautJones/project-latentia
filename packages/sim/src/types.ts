import type { SideSetup } from '@latentia/engine';

/** A named team, grid and Autopilot deck the simulator can put on either side of a battle. */
export type Archetype = { id: string; side: SideSetup };

/** Tallies of a run of seeded battles, from side A's point of view. `rounds[i]` is the length of battle i. */
export type MatchStats = { winsA: number; winsB: number; draws: number; rounds: number[] };

export type Verdict = 'pass' | 'fail' | 'inconclusive';
