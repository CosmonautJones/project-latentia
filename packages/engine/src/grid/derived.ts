import { activeCardCount, toolStepsFor, VERSION_SLOTS } from './adjacency.js';
import type { GridLayout, PlacedPiece } from './model.js';

// Per-battle memo of the grid derivations a battle asks for every round (C3.5, Ruling 135): a subagent's active-card
// count (levers.ts activeCards) and an orchestrator move's piece and Tool steps (damage.ts pieceBonus).
//
// Why a WeakMap keyed by the GridLayout object, not plain data on BattleState: a battle never changes a grid. Its
// `GridLayout` is the side's own copy of the setup grid (setup.ts), typed readonly throughout, and forced compaction
// records what it does in the orchestrator's ContextState (`summarizedPieces`, `removedSlots`), never in the layout.
// Every value memoised here is a function of the layout alone — what reads compaction state (the Summary halving,
// removed slots) still reads ContextState live — so an entry is never stale while its grid object lives. Keeping
// the memo off the state leaves BattleState exactly the JSON data it was (spec §4): canonical form, structuredClone,
// clonePlain and replay see no new field. A clone (submitRound's structuredClone, replay's fresh createBattle) is a
// new object, so it misses and recomputes from its own data: a memo is never shared between two states. A caller
// that swaps a side's grid for another object (as unit tests do) misses the same way. Values are numbers or a piece
// found in grid piece order, exactly as the recomputation gives them, so no iteration order depends on the memo.
// The public adjacency functions (index.ts activeCardCount) stay uncached: callers may edit their own layouts.

type Derived = {
  /** Subagent Slot piece id → Example Cards orthogonally adjacent to it (activeCardCount before the version cap). */
  exampleCards: Map<string, number>;
  /** Skill piece id → its Tool steps (toolStepsFor). */
  toolSteps: Map<string, number>;
  /** Move id → the first Skill or Graft piece (grid piece order) holding it, or null when none does. */
  movePieces: Map<string, PlacedPiece | null>;
};

const memo = new WeakMap<GridLayout, Derived>();

function derivedOf(grid: GridLayout): Derived {
  let d = memo.get(grid);
  if (d === undefined) {
    d = { exampleCards: new Map(), toolSteps: new Map(), movePieces: new Map() };
    memo.set(grid, d);
  }
  return d;
}

/** activeCardCount(grid, slotId, version), memoised per grid object. */
export function gridActiveCards(grid: GridLayout, slotId: string, version: keyof typeof VERSION_SLOTS): number {
  const d = derivedOf(grid);
  let cards = d.exampleCards.get(slotId);
  if (cards === undefined) {
    // Capped at v4's 8, the largest cap: min(min(n, 8), cap) = min(n, cap) for every version cap.
    cards = activeCardCount(grid, slotId, 'v4');
    d.exampleCards.set(slotId, cards);
  }
  const cap = VERSION_SLOTS[version];
  return cards < cap ? cards : cap;
}

/** toolStepsFor(grid, pieceId), memoised per grid object. */
export function gridToolSteps(grid: GridLayout, pieceId: string): number {
  const d = derivedOf(grid);
  let steps = d.toolSteps.get(pieceId);
  if (steps === undefined) {
    steps = toolStepsFor(grid, pieceId);
    d.toolSteps.set(pieceId, steps);
  }
  return steps;
}

/** The first Skill or Graft piece (grid piece order) whose moveId is `moveId`, or null; memoised per grid object. */
export function gridMovePiece(grid: GridLayout, moveId: string): PlacedPiece | null {
  const d = derivedOf(grid);
  let piece = d.movePieces.get(moveId);
  if (piece === undefined) {
    piece = grid.pieces.find((p) => (p.kind === 'skill' || p.kind === 'graft') && p.moveId === moveId) ?? null;
    d.movePieces.set(moveId, piece);
  }
  return piece;
}
