// The graft path's preset Context Grid (plan: "Graft: its signature becomes a grid piece on your orchestrator"; v0 has
// no grid editor, so the grid is fixed). A gridded orchestrator's moves come from its grid (engine Ruling 82): its
// species signature, then its Skill and Graft pieces. The L5 grid is 5×4 (engine gridSizeFor). Layout, x right, y down:
//
//   P P P g .     P System Prompt   g the Graft (Tokenibble's L-shaped Token Nibble)
//   K K t g g     K, M, L the starter's three other moves as Skills
//   L L M M .     t one Tool, touching Skills K and M: +10% power on each
//   . . . . .
//
// 13 cells used, so the orchestrator's context window is 7 (the headroom) instead of the gridless 12; when it fills,
// forced compaction summarises a Skill or the Graft to free cells (engine context/store.ts). validateSetup checks the
// whole thing (test/unit/battles.test.ts).

import { gridSizeFor, SPECIES, type GridLayout, type PlacedPiece } from '@latentia/engine';
import type { StarterId } from '../flow/flow.js';

/**
 * Each starter's Skills, by letter (the same assignment as the simulator's starter grid, sim archetypes/starter-grids.ts):
 * K and M touch the Tool, L does not.
 */
export const STARTER_SKILLS: Readonly<Record<StarterId, { readonly K: string; readonly M: string; readonly L: string }>> = {
  sagelet: { K: 'chain-of-thought', M: 'proof-by-contradiction', L: 'step-back-prompt' },
  blitzr: { K: 'distilled-strike', M: 'token-burst', L: 'low-latency' },
  forkling: { K: 'leaderboard-flex', M: 'community-patch', L: 'swarm-of-fine-tunes' },
};

/** The species whose signature is grafted in v0: the trailhead's Tokenibble. */
export const GRAFT_SPECIES = 'tokenibble' as const;
export const GRAFT_MOVE = SPECIES[GRAFT_SPECIES].signature;

const skill = (id: string, moveId: string, anchor: readonly [number, number]): PlacedPiece => ({ id, kind: 'skill', shape: [[0, 0], [1, 0]], anchor, rotation: 0, moveId });

/** The L5 graft grid for `starter`: the starter's Skills, one Tool, and Tokenibble's signature as a Graft piece. */
export function graftGrid(starter: StarterId, level: number): GridLayout {
  const { width, height } = gridSizeFor(level);
  const s = STARTER_SKILLS[starter];
  return {
    width,
    height,
    // Array order is the compaction order: the least useful pieces go first.
    pieces: [
      { id: 'prompt', kind: 'systemPrompt', shape: [[0, 0], [1, 0], [2, 0]], anchor: [0, 0], rotation: 0 },
      skill('skill.L', s.L, [0, 2]),
      { id: 'tool', kind: 'tool', shape: [[0, 0]], anchor: [2, 1], rotation: 0 },
      skill('skill.M', s.M, [2, 2]),
      skill('skill.K', s.K, [0, 1]),
      { id: `graft.${GRAFT_MOVE}`, kind: 'graft', shape: SPECIES[GRAFT_SPECIES].graftShape, anchor: [3, 0], rotation: 0, moveId: GRAFT_MOVE },
    ],
  };
}
